"""plan: split upstream release tags after base into sync steps.

Tags come from local refs (`git tag -l`) or from the upstream remote
(`git ls-remote --tags`, flag --remote-tags). Explicit-tag mode orders by
version and needs NO common ancestor: file counts use `git diff --name-only A B`.
Tiny steps (fewer than --min-files changed files) are grouped with the next one.
"""
import json
import os
import re
import subprocess
import sys

from . import common as C


def version_key(tag):
    """'v18.6.0' -> (18, 6, 0). Non-numeric parts drop out."""
    return tuple(int(x) for x in re.findall(r"\d+", tag))


def list_tags(repo, profile, remote_tags):
    regex = re.compile(profile["upstream"]["tag_regex"])
    if remote_tags:
        remote = profile["upstream"]["remote_name"]
        out = C.run_git(["ls-remote", "--tags", "--refs", remote], cwd=repo)
        names = [line.split("\t")[1][len("refs/tags/"):] for line in out.splitlines() if "\t" in line]
    else:
        names = [t for t in C.run_git(["tag", "-l"], cwd=repo).splitlines() if t]
    tags = [t for t in set(names) if regex.search(t)]
    return sorted(tags, key=version_key)


def select_after_base(repo, profile, tags, base):
    """Tags strictly after base. Merge-base mode also needs base to be an ancestor."""
    mode = profile["base"]["mode"]
    base_ref = profile["base"].get("ref") or base
    if mode == "explicit-tag":
        base_key = version_key(base_ref)
        return [t for t in tags if version_key(t) > base_key]
    return [t for t in tags if _is_ancestor(repo, base_ref, t)]


def _is_ancestor(repo, a, b):
    proc = subprocess.run(["git", "merge-base", "--is-ancestor", a, b], cwd=repo)
    return proc.returncode == 0


def step_stats(repo, prev, tag):
    commits = int(C.run_git(["rev-list", "--count", "%s..%s" % (prev, tag)], cwd=repo).strip() or 0)
    files = [f for f in C.run_git(["diff", "--name-only", prev, tag], cwd=repo).splitlines() if f]
    return {"from": prev, "to": tag, "commits": commits, "files": len(files)}


def build_steps(repo, base, tags, min_files):
    """Group consecutive tags until each step has at least min_files changed files."""
    steps = []
    start = base
    pending = []
    for tag in tags:
        pending.append(tag)
        stats = step_stats(repo, start, tag)
        if stats["files"] >= min_files or tag == tags[-1]:
            stats["tags"] = list(pending)
            steps.append(stats)
            start = tag
            pending = []
        # else: tiny step, keep accumulating from the same start
    return steps


def register(subparsers, common_args=None):
    sp = subparsers.add_parser("plan", help="list release steps after base")
    sp.add_argument("--repo", default=".")
    sp.add_argument("--profile", default=None)
    sp.add_argument("--remote-tags", action="store_true", help="read tags with git ls-remote")
    sp.add_argument("--min-files", type=int, default=50, help="group steps smaller than this")
    sp.add_argument("--out", default=None, help="write plan JSON here")
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=run)
    return sp


def run(args):
    repo = os.path.realpath(args.repo)
    try:
        profile = C.load_profile(args.profile or os.path.join(repo, ".fork-sync", "profile.yaml"))
        base = profile["base"].get("ref") or ""
        tags = select_after_base(repo, profile, list_tags(repo, profile, args.remote_tags),
                                 base)
        steps = build_steps(repo, base, tags, args.min_files) if tags else []
    except (C.SchemaError, RuntimeError) as exc:
        sys.stderr.write("plan: %s\n" % exc)
        return 2
    plan = {"base": profile["base"].get("ref"), "mode": profile["base"]["mode"],
            "min_files": args.min_files, "steps": steps}
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(plan, fh, ensure_ascii=False, indent=2)
    if args.json:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
    else:
        print("| # | to | commits | files | tags |")
        print("|---|---|---|---|---|")
        for i, s in enumerate(steps, 1):
            print("| %d | %s | %d | %d | %s |" % (i, s["to"], s["commits"], s["files"], ", ".join(s["tags"])))
        print("%d step(s) after base" % len(steps))
    return 0
