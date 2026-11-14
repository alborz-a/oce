"""analyze: classify every upstream change base..target against ours.

Scales to ~11k changed files: one `git diff --name-status -M` for upstream,
one `git diff --name-only` for ours, set intersection, then `git merge-file`
only on the intersection, inside a temp dir. Never writes to the checkout.
"""
import json
import os
import shutil
import sys
import tempfile

from . import common as C
from . import step as S

UI_EXTS = (".tsx", ".jsx", ".ts", ".js", ".hbs", ".vue", ".html", ".svelte")
CLASSES = (
    "clean",
    "auto-resolvable",
    "conflict-ledger",
    "upstream-deleted-renamed-ours-changed",
    "new-untranslated-strings",
    "new-english-ui",
)
MAX_LISTED = 200


def _load_ledger_bytes(data):
    tmp = tempfile.mkdtemp(prefix="forksync-ledger-")
    try:
        path = os.path.join(tmp, "ledger.yaml")
        with open(path, "wb") as fh:
            fh.write(data)
        return C.load_ledger(path)["entries"]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _ledger_entries(profile, repo, ours, ledger_file=None, unit_prefix=""):
    """Collect (unit_path, entry) from every unit ledger at ours.

    Ledgers live in the parent repo, so a unit checkout passes the parent as
    `repo` and its ledger ref as `ours`. With ledger_file, one ledger file on disk
    is used for the unit at unit_prefix instead of the ledgers at ours.
    Returns (entries, ledgers_found).
    """
    if ledger_file:
        with open(ledger_file, "rb") as fh:
            entries = _load_ledger_bytes(fh.read())
        return [(unit_prefix or ".", e) for e in entries], 1
    out = []
    found = 0
    for unit in profile["units"]:
        rel = os.path.normpath(os.path.join(unit["path"], unit["ledger"]))
        data = C.show_file(ours, rel.replace(os.sep, "/"), repo)
        if data is None:
            continue
        found += 1
        for entry in _load_ledger_bytes(data):
            out.append((unit["path"], entry))
    return out, found


def _matching_entries(path, ledger):
    hits = []
    for unit_path, entry in ledger:
        if unit_path not in (".", "") and not path.startswith(unit_path.rstrip("/") + "/"):
            continue
        rel = path if unit_path in (".", "") else path[len(unit_path.rstrip("/")) + 1:]
        if C.match_glob(rel, entry["glob"]):
            hits.append(entry)
    return hits


def _locale_pairs(profile, path):
    """(locale spec, target path) for each profile locale whose source file is `path`."""
    out = []
    base_name = os.path.basename(path)
    for loc in profile.get("locales", []):
        tgt_name = os.path.basename(loc["glob"])
        src_name = loc.get("source_name") or C.LOCALE_SOURCE_NAMES.get(tgt_name)
        if src_name != base_name:
            continue
        target_path = os.path.join(os.path.dirname(path), tgt_name).replace(os.sep, "/")
        if C.match_glob(target_path, loc["glob"]):
            out.append((loc, target_path))
    return out


def _untranslated_keys(repo, base, target, ours, src, tgt, fmt):
    """Source keys added or changed upstream (theirs vs base) with no key in ours' target file."""
    def flat(ref, path):
        data = C.show_file(ref, path, repo)
        return C.parse_locale((data or b"").decode("utf-8", "replace"), fmt)
    theirs = flat(target, src)
    before = flat(base, src)
    changed = [k for k, v in theirs.items() if before.get(k) != v]
    ours_keys = flat(ours, tgt)
    return sorted(k for k in changed if k not in ours_keys)


def _locale_fmt(profile, path):
    for loc in profile.get("locales", []):
        if C.match_glob(path, loc["glob"]):
            return loc["format"]
    return None


def _merge_clean(base, ours, theirs):
    """True when git merge-file resolves without conflict markers."""
    tmp = tempfile.mkdtemp(prefix="forksync-analyze-")
    try:
        _merged, conflicts = S.merge_file(ours, base, theirs, tmp)
        return conflicts == 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def analyze(repo, profile, base, ours, target, ledger_repo=None, ledger_ref=None, unit_prefix="",
            ledger_file=None, no_ledger=False):
    """Return the analysis dict. Pure read: git objects only, no checkout writes.

    unit_prefix is the unit path inside the ledger repo (e.g. packages/fleetops
    when repo is that submodule checkout). Ledger globs match the prefixed path.
    """
    upstream = S.parse_name_status(
        C.run_git(["diff", "--name-status", "-M", base, target], cwd=repo))
    ours_changed = set(
        p for p in C.run_git(["diff", "--name-only", base, ours], cwd=repo).splitlines() if p)
    if no_ledger:
        ledger = []
    else:
        ledger, found = _ledger_entries(profile, ledger_repo or repo, ledger_ref or ours,
                                        ledger_file=ledger_file, unit_prefix=unit_prefix)
        if found == 0:
            raise RuntimeError("no unit ledger at %s in %s; pass --ledger-file PATH or --no-ledger"
                               % (ledger_ref or ours, ledger_repo or repo))
    classes = {name: [] for name in CLASSES}
    counts = {name: 0 for name in CLASSES}
    counts["unchanged-by-ours"] = 0
    scored = []
    category_hits = {}
    untranslated_total = 0

    def add(name, item):
        counts[name] += 1
        if len(classes[name]) < MAX_LISTED:
            classes[name].append(item)

    for status, old, new in upstream:
        touched_ours = old in ours_changed or new in ours_changed
        if not touched_ours:
            counts["clean"] += 1
            continue
        base_bytes = C.show_file(base, old, repo)
        theirs_bytes = None if status == "D" else C.show_file(target, new, repo)
        ours_bytes = C.show_file(ours, new, repo)
        hits = _matching_entries(os.path.join(unit_prefix, new) if unit_prefix else new, ledger)
        conflict_hits = 0
        deleted_hit = 0
        if status == "D" or old != new:
            deleted_hit = 1
            add("upstream-deleted-renamed-ours-changed", {"path": new, "old": old, "status": status})
        elif _locale_fmt(profile, new):
            add("auto-resolvable", {"path": new, "how": "translate-merge"})
        elif ours_bytes is None or ours_bytes == base_bytes or ours_bytes == theirs_bytes:
            add("auto-resolvable", {"path": new, "how": "trivial"})
        elif _merge_clean(base_bytes or b"", ours_bytes, theirs_bytes or b""):
            add("auto-resolvable", {"path": new, "how": "merge-file"})
        else:
            conflict_hits = 1
            ids = [e["id"] for e in hits]
            add("conflict-ledger", {"path": new, "entries": ids})
            for entry in hits:
                category_hits[entry["category"]] = category_hits.get(entry["category"], 0) + 1
        size_kb = len(theirs_bytes or b"") / 1024.0
        score = len(hits) * 5 + conflict_hits * 3 + deleted_hit * 3 + min(size_kb, 500) / 50.0
        scored.append({"path": new, "score": round(score, 2), "ledger_hits": len(hits),
                       "conflict": bool(conflict_hits), "deleted": bool(deleted_hit)})

    for status, old, new in upstream:
        if status != "D":
            for loc, target_path in _locale_pairs(profile, new):
                missing = _untranslated_keys(repo, base, target, ours, new, target_path, loc["format"])
                if missing:
                    untranslated_total += len(missing)
                    add("new-untranslated-strings", {"path": target_path, "source": new,
                                                     "count": len(missing), "keys": missing[:50]})
        if new.endswith(".yaml") or new.endswith(".json") or new.endswith(".ts"):
            fmt = _locale_fmt(profile, new)
            if fmt and status != "D":
                # Target-locale file changed upstream: its own keys missing in ours.
                theirs_flat = C.parse_locale((C.show_file(target, new, repo) or b"").decode("utf-8", "replace"), fmt)
                ours_flat = C.parse_locale((C.show_file(ours, new, repo) or b"").decode("utf-8", "replace"), fmt)
                missing = sorted(k for k in theirs_flat if k not in ours_flat)
                if missing:
                    untranslated_total += len(missing)
                    add("new-untranslated-strings", {"path": new, "count": len(missing),
                                                     "keys": missing[:50]})
        if status == "A" and new.endswith(UI_EXTS):
            body = (C.show_file(target, new, repo) or b"").decode("utf-8", "replace")
            if not C.has_farsi(body):
                add("new-english-ui", {"path": new})

    riskiest = sorted(scored, key=lambda r: r["score"], reverse=True)[:10]
    return {
        "target": target,
        "base": base,
        "ours": ours,
        "upstream_changed": len(upstream),
        "ours_changed": len(ours_changed),
        "counts": counts,
        "ledger_categories_hit": category_hits,
        "new_untranslated_keys": untranslated_total,
        "riskiest": riskiest,
        "classes": classes,
    }


def to_markdown(res):
    lines = ["# analyze %s" % res["target"], "",
             "base `%s`, ours `%s`" % (res["base"], res["ours"]), "",
             "| class | count |", "|---|---|"]
    for name in CLASSES:
        lines.append("| %s | %d |" % (name, res["counts"][name]))
    lines += ["", "## Riskiest 10", "", "| path | score | ledger hits | conflict | deleted |", "|---|---|---|---|---|"]
    for r in res["riskiest"]:
        lines.append("| `%s` | %s | %d | %s | %s |" % (
            r["path"], r["score"], r["ledger_hits"], r["conflict"], r["deleted"]))
    lines += ["", "## Ledger categories hit", ""]
    for cat, n in sorted(res["ledger_categories_hit"].items()):
        lines.append("- %s: %d" % (cat, n))
    return "\n".join(lines) + "\n"


def register(subparsers, common_args=None):
    sp = subparsers.add_parser("analyze", help="classify upstream changes vs ours")
    sp.add_argument("--repo", default=".")
    sp.add_argument("--profile", default=None)
    sp.add_argument("--target", required=True)
    sp.add_argument("--base", default=None)
    sp.add_argument("--ours", default=None)
    sp.add_argument("--out-dir", default="analyze-out")
    sp.add_argument("--unit", default=None,
                    help="unit name for output file names; default: --unit-path or 'parent'")
    sp.add_argument("--ledger-file", default=None,
                    help="read the unit ledger from this file instead of from ours")
    sp.add_argument("--no-ledger", action="store_true", help="skip ledger hits (no ledger in ours)")
    sp.add_argument("--ledger-repo", default=None,
                    help="repo that holds the unit ledgers (parent of a submodule unit)")
    sp.add_argument("--ledger-ref", default=None, help="ref in --ledger-repo that holds the ledgers")
    sp.add_argument("--unit-path", default="",
                    help="unit path inside --ledger-repo, e.g. packages/fleetops")
    sp.add_argument("--json", action="store_true", help="print JSON to stdout")
    sp.set_defaults(func=run)
    return sp


def run(args):
    repo = os.path.realpath(args.repo)
    try:
        profile = C.load_profile(args.profile or os.path.join(repo, ".fork-sync", "profile.yaml"))
        ours = args.ours or profile["ours"]["branch"]
        base = args.base or profile["base"].get("ref") or C.run_git(
            ["merge-base", ours, args.target], cwd=repo).strip()
        ledger_repo = getattr(args, "ledger_repo", None)
        ledger_repo = os.path.realpath(ledger_repo) if ledger_repo else None
        ledger_file = getattr(args, "ledger_file", None)
        ledger_file = os.path.realpath(ledger_file) if ledger_file else None
        res = analyze(repo, profile, base, ours, args.target, ledger_repo=ledger_repo,
                      ledger_ref=getattr(args, "ledger_ref", None),
                      unit_prefix=(getattr(args, "unit_path", "") or "").strip("/"),
                      ledger_file=ledger_file, no_ledger=getattr(args, "no_ledger", False))
    except (C.SchemaError, RuntimeError) as exc:
        sys.stderr.write("analyze: %s\n" % exc)
        return 2
    os.makedirs(args.out_dir, exist_ok=True)
    unit = args.unit or (getattr(args, "unit_path", "") or "").strip("/").replace("/", "-") or "parent"
    slug = "%s-%s" % (unit, args.target.replace("/", "_"))
    json_path = os.path.join(args.out_dir, "analyze-%s.json" % slug)
    md_path = os.path.join(args.out_dir, "analyze-%s.md" % slug)
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=2)
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(to_markdown(res))
    if args.json:
        print(json.dumps(res["counts"], indent=2))
    else:
        print("analyze %s: %s" % (args.target, ", ".join(
            "%s=%d" % (k, res["counts"][k]) for k in CLASSES)))
        print("wrote %s and %s" % (json_path, md_path))
    return 0
