"""step: apply ONE upstream step (base -> target) into a throwaway worktree.

Never touches a main checkout. Per file: `git merge-file` three-way (base,
ours, theirs read with `git show`). Locale files merge key-wise via
translate_merge. Conflicts stay as markers and are listed in step-report.json.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

from . import common as C
from . import translate_merge as TM

HERE = os.path.dirname(os.path.abspath(__file__))
FORKSYNC = os.path.join(os.path.dirname(HERE), "forksync.py")


class StepError(RuntimeError):
    """Refusal or failure that stops the step before any write."""


def primary_worktree(repo):
    """Path of the repo's primary (main) worktree, from `git worktree list`."""
    out = C.run_git(["worktree", "list", "--porcelain"], cwd=repo)
    for line in out.splitlines():
        if line.startswith("worktree "):
            return os.path.realpath(line[len("worktree "):])
    raise StepError("cannot read primary worktree")


def check_worktree_path(repo, wt):
    """Refuse main checkouts and existing paths. Returns the real path."""
    real = os.path.realpath(wt)
    if real == primary_worktree(repo):
        raise StepError("refusing: %s is the repo's primary worktree" % wt)
    if os.path.isdir(os.path.join(wt, ".git")):
        raise StepError("refusing: %s has its own .git directory (main checkout)" % wt)
    if os.path.exists(real):
        raise StepError("refusing: %s already exists; pass a new path" % wt)
    return real


def parse_name_status(text):
    """Parse `git diff --name-status -M` output to [(status, old, new)]."""
    rows = []
    for line in text.splitlines():
        parts = line.split("\t")
        if not parts or not parts[0]:
            continue
        status = parts[0][0]
        if status in ("R", "C"):
            rows.append((status, parts[1], parts[2]))
        else:
            rows.append((status, parts[1], parts[1]))
    return rows


def merge_file(ours, base, theirs, tmpdir):
    """Three-way `git merge-file -p`. Returns (merged_bytes, conflict_count)."""
    paths = []
    for name, data in (("ours", ours), ("base", base), ("theirs", theirs)):
        p = os.path.join(tmpdir, name)
        with open(p, "wb") as fh:
            fh.write(data or b"")
        paths.append(p)
    proc = subprocess.run(["git", "merge-file", "-p", *paths], capture_output=True)
    if proc.returncode < 0:
        raise StepError("git merge-file failed on signal %d" % -proc.returncode)
    return proc.stdout, proc.returncode


def _write(wt, path, data):
    full = os.path.join(wt, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as fh:
        fh.write(data)


def apply_step(repo, wt, base, ours, target, profile):
    """Apply base->target onto ours inside wt. Returns report dict (no commit)."""
    report = {"applied": [], "conflicts": [], "deleted": [], "warnings": [], "locale": []}
    changes = parse_name_status(
        C.run_git(["diff", "--name-status", "-M", base, target], cwd=repo)
    )
    tmpdir = tempfile.mkdtemp(prefix="forksync-step-")
    try:
        for status, old, new in changes:
            base_bytes = C.show_file(base, old, repo)
            theirs_bytes = None if status == "D" else C.show_file(target, new, repo)
            ours_bytes = C.show_file(ours, new, repo)
            locale_fmt = _locale_format(profile, new)
            if status == "D":
                if ours_bytes is None or ours_bytes == base_bytes:
                    full = os.path.join(wt, new)
                    if os.path.exists(full):
                        os.remove(full)
                    report["deleted"].append(new)
                else:
                    report["conflicts"].append({"path": new, "kind": "upstream-deleted-ours-changed"})
                continue
            if locale_fmt:
                out, new_keys, warns = TM.translate_merge(
                    (base_bytes or b"").decode("utf-8"),
                    (ours_bytes or b"").decode("utf-8"),
                    theirs_bytes.decode("utf-8"),
                    locale_fmt,
                )
                _write(wt, new, out.encode("utf-8"))
                report["locale"].append({"path": new, "new_keys": len(new_keys), "warnings": warns})
                report["applied"].append(new)
                continue
            if ours_bytes is None or ours_bytes == base_bytes:
                _write(wt, new, theirs_bytes)
                report["applied"].append(new)
                continue
            if ours_bytes == theirs_bytes:
                continue
            merged, conflicts = merge_file(ours_bytes, base_bytes, theirs_bytes, tmpdir)
            _write(wt, new, merged)
            report["applied"].append(new)
            if conflicts:
                report["conflicts"].append({"path": new, "kind": "markers", "count": conflicts})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return report


def _locale_format(profile, path):
    for loc in profile.get("locales", []):
        if C.match_glob(path, loc["glob"]):
            return loc["format"]
    return None


def run_guard(wt, profile_path):
    """Run `forksync.py guard` in a subprocess. Returns {exit, summary}."""
    proc = subprocess.run(
        [sys.executable, FORKSYNC, "guard", "--profile", profile_path, "--tree", wt],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    return {"exit": proc.returncode, "summary": lines[-1] if lines else proc.stderr.strip()}


def git_merge_step(repo, wt, target):
    """--use-git-merge: `git merge --no-commit --no-ff target` inside wt."""
    proc = subprocess.run(
        ["git", "merge", "--no-commit", "--no-ff", target], cwd=wt, capture_output=True, encoding="utf-8"
    )
    conflicts = C.run_git(["diff", "--name-only", "--diff-filter=U"], cwd=wt, check=False).split()
    if proc.returncode != 0 and not conflicts:
        raise StepError("git merge failed: %s" % proc.stderr.strip())
    return {"conflicts": [{"path": p, "kind": "git-merge"} for p in conflicts]}


def register(subparsers, common_args=None):
    sp = subparsers.add_parser("step", help="apply one upstream step in a throwaway worktree")
    sp.add_argument("--target", required=True, help="upstream tag or commit to apply")
    sp.add_argument("--worktree", required=True, help="NEW path for the throwaway worktree")
    sp.add_argument("--repo", default=".", help="fork repo (any checkout of it)")
    sp.add_argument("--profile", default=None, help="profile.yaml (default: in the repo at ours)")
    sp.add_argument("--base", default=None, help="base ref (default: profile base or merge-base)")
    sp.add_argument("--ours", default=None, help="our branch (default: profile ours.branch)")
    sp.add_argument("--report", default="step-report.json")
    sp.add_argument("--commit", action="store_true", help="commit when there are no conflicts")
    sp.add_argument("--use-git-merge", action="store_true", help="use git merge instead of per-file merge")
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=run)
    return sp


def run(args):
    repo = os.path.realpath(args.repo)
    try:
        wt = check_worktree_path(repo, args.worktree)
        profile_src = args.profile or os.path.join(repo, ".fork-sync", "profile.yaml")
        profile = C.load_profile(profile_src)
        ours = args.ours or profile["ours"]["branch"]
        base = args.base or profile["base"].get("ref") or C.run_git(
            ["merge-base", ours, args.target], cwd=repo).strip()
        C.run_git(["worktree", "add", "--detach", wt, ours], cwd=repo)
        C.run_git(["config", "rerere.enabled", "true"], cwd=wt)
        profile_in_wt = os.path.join(wt, ".fork-sync", "profile.yaml")
        if args.use_git_merge:
            body = git_merge_step(repo, wt, args.target)
            body["applied"] = []
        else:
            body = apply_step(repo, wt, base, ours, args.target, profile)
        conflicts = body.get("conflicts", [])
        committed = None
        if args.commit and not conflicts:
            paths = sorted(set(body.get("applied", [])) | set(body.get("deleted", [])))
            if paths:
                C.run_git(["add", "--", *paths], cwd=wt)
                C.run_git(["commit", "-m", "sync: upstream %s" % args.target], cwd=wt)
                committed = C.run_git(["rev-parse", "HEAD"], cwd=wt).strip()
        guard = run_guard(wt, profile_in_wt) if os.path.exists(profile_in_wt) else None
        report = {
            "target": args.target,
            "base": base,
            "ours": ours,
            "worktree": wt,
            "mode": "git-merge" if args.use_git_merge else "merge-file",
            "conflicts": conflicts,
            "applied": body.get("applied", []),
            "deleted": body.get("deleted", []),
            "locale": body.get("locale", []),
            "warnings": body.get("warnings", []),
            "guard": guard,
            "committed": committed,
        }
    except (StepError, C.SchemaError, RuntimeError) as exc:
        sys.stderr.write("step: %s\n" % exc)
        return 2
    with open(args.report, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("step %s: applied %d, conflicts %d, deleted %d, guard %s, report %s" % (
            args.target, len(report["applied"]), len(conflicts), len(report["deleted"]),
            guard["exit"] if guard else "n/a", args.report))
    return 1 if conflicts else 0
