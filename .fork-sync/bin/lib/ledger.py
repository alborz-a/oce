"""ledger-gen and learn: derive ledger entries from the git diff base..ours.

Deterministic: same repo state gives the same entries. Every generated
invariant is checked against the ours tree at generation time, so a clean
tree passes guard.
"""
import datetime
import json
import math
import os
import re

from . import common as C

RTL_EXTS = (".css", ".scss", ".sass", ".less", ".hbs", ".tsx", ".jsx", ".vue", ".html")
RTL_RE = re.compile(
    r"\brtl\b|direction\s*:|\bdir=|text-align|row-reverse"
    r"|(margin|padding|border|inset)-(inline|block)|\bisRtl\b",
    re.IGNORECASE,
)
ACCESS_PATH_RE = re.compile(r"auth|permission|policy|middleware|role|route|guard|login|otp", re.IGNORECASE)
BRAND_RE = re.compile(r"brand|logo|splash|manifest|title|favicon", re.IGNORECASE)
IRAN_RE = re.compile(
    r"\bIRR\b|\brials?\b|\bjalali\b|\bpersian\b|\bfa-IR\b|Asia/Tehran|\btoman\b",
    re.IGNORECASE,
)
# Binary assets: only file presence is checked (for added files), never their lines.
BINARY_EXTS = (
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".woff", ".woff2",
    ".ttf", ".eot", ".otf", ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov",
    ".pdf", ".zip", ".gz", ".tgz", ".jar", ".keystore", ".jks", ".psd",
)
MAX_LINES = 8
MIN_LINE_LEN = 12
COMMENT_PREFIXES = ("//", "/*", "*", "<!--", "#")
TRACKED_NUMERIC = ("min_keys", "require_farsi_fraction", "min_fraction")


class WeakenError(RuntimeError):
    """An auto invariant would get weaker and no --allow-weaken was given."""


def _norm(text):
    return " ".join(text.split())


def categorize(path, changed_lines, status):
    """Category for one non-locale file. Order sets precedence."""
    if ACCESS_PATH_RE.search(path):
        return "access"
    if BRAND_RE.search(path) or any(BRAND_RE.search(line) for line in changed_lines):
        return "branding"
    if any(IRAN_RE.search(line) for line in changed_lines):
        return "iran-lock"
    ext = os.path.splitext(path)[1].lower()
    if ext in RTL_EXTS and any(RTL_RE.search(line) for line in changed_lines):
        return "rtl"
    return "fork-only" if status == "A" else "bugfix"


def distinctive(lines, limit=MAX_LINES):
    """Normalised, non-trivial, deduped lines; longest first, then alphabetical."""
    seen = set()
    out = []
    for raw in lines:
        text = _norm(raw)
        if len(text) < MIN_LINE_LEN or text.startswith(COMMENT_PREFIXES) or text in seen:
            continue
        seen.add(text)
        out.append(text)
    out.sort(key=lambda t: (-len(t), t))
    return out[:limit]


def _floor4(value):
    return math.floor(value * 10000) / 10000.0


def _diff_lines(repo, base, ours, path):
    out = C.run_git(["diff", "--relative", "-U0", "--no-color", base, ours, "--", path], cwd=repo)
    added, deleted = [], []
    for line in out.splitlines():
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added.append(line[1:])
        elif line.startswith("-"):
            deleted.append(line[1:])
    return added, deleted


def _locale_spec(path, profile):
    for loc in (profile or {}).get("locales", []):
        if C.match_glob(path, loc["glob"]):
            return loc
    return None


def _ours_text(repo, ours, path):
    # "./path" makes git resolve relative to repo (unit) root, not the git toplevel.
    data = C.show_file(ours, "./" + path, repo)
    return None if data is None else data.decode("utf-8", errors="replace")


def _ignored(path, profile):
    globs = ((profile or {}).get("guard") or {}).get("ignore", C.DEFAULT_IGNORE)
    return any(C.match_glob(path, glob) for glob in globs)


def collect_specs(repo, base, ours, profile=None, paths=None):
    """Return a list of (path, category, invariant, status) tuples, sorted by path then kind."""
    rows = C.run_git(
        ["diff", "--relative", "--no-renames", "--name-status", base, ours], cwd=repo
    ).splitlines()
    specs = []
    for row in sorted(rows, key=lambda r: r.split("\t", 1)[-1]):
        status_raw, _, path = row.partition("\t")
        status = status_raw[:1]
        if not path or (paths is not None and path not in paths):
            continue
        # Profile locale files are always checked, even when an ignore glob matches.
        if _ignored(path, profile) and _locale_spec(path, profile) is None:
            continue
        if status == "D":
            specs.append((path, "removed-feature", {"type": "file_absent", "path": path}, status))
            continue
        if path.lower().endswith(BINARY_EXTS):
            # Binary assets: presence only, never lines.
            if status == "A":
                specs.append((path, categorize(path, [], status), {"type": "file_exists", "path": path}, status))
            continue
        text = _ours_text(repo, ours, path)
        if text is None:
            continue
        locale = _locale_spec(path, profile)
        if locale is not None:
            parsed = C.parse_locale(text, locale["format"])
            values = list(parsed.values())
            farsi = sum(1 for v in values if C.has_farsi(v))
            ratio = farsi / float(len(values)) if values else 0.0
            inv = {
                "type": "locale_keys",
                "path": path,
                "format": locale["format"],
                "min_keys": len(values),
                "require_farsi_fraction": _floor4(ratio),
                "forbid_equal_to_source": True,
            }
            specs.append((path, "translation", inv, status))
            continue
        added, deleted = _diff_lines(repo, base, ours, path)
        category = categorize(path, added + deleted, status)
        ours_norm = set(_norm(line) for line in text.splitlines())
        present = [t for t in distinctive(added) if t in ours_norm]
        gone = [t for t in distinctive(deleted) if t not in ours_norm] if status == "M" else []
        if present or gone:
            # file_lines already fails when the file is missing, so no separate file_exists.
            inv = {"type": "file_lines", "path": path, "lines": present, "absent": gone}
            specs.append((path, category, inv, status))
        elif status == "A":
            specs.append((path, category, {"type": "file_exists", "path": path}, status))
    return specs


def _intent(path, category, status):
    return "auto: %s %s (%s)" % (status, path, category)


def build(repo, base, ours, profile=None, paths=None, at=None, existing=None):
    """Build the full ledger dict. existing keeps owner entries and stable ids."""
    scope = set(paths) if paths is not None else None
    specs = collect_specs(repo, base, ours, profile, scope)
    old_auto = {}
    kept = []
    for entry in (existing or {}).get("entries", []):
        if not entry.get("auto", True):
            kept.append(entry)
            continue
        if scope is not None and entry["glob"] not in scope:
            kept.append(entry)
            continue
        old_auto[(entry["glob"], entry["invariant"]["type"])] = entry
    next_num = max([int(e["id"][1:]) for e in kept + list(old_auto.values()) if e["id"][1:].isdigit()] or [0]) + 1
    generated = []
    for path, category, inv, status in specs:
        key = (path, inv["type"])
        old = old_auto.get(key)
        if old is not None:
            eid = old["id"]
        else:
            eid = "L%04d" % next_num
            next_num += 1
        generated.append(
            {
                "id": eid,
                "glob": path,
                "category": category,
                "intent": _intent(path, category, status),
                "auto": True,
                "invariant": inv,
            }
        )
    entries = sorted(kept + generated, key=lambda e: e["id"])
    stamp = at or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "version": 1,
        "generated_from": {"base": base, "ours": ours, "at": stamp},
        "entries": entries,
    }


def _weakened(old_inv, new_inv):
    out = []
    for key in TRACKED_NUMERIC:
        if key in old_inv and key in new_inv and new_inv[key] < old_inv[key]:
            out.append("%s %s->%s" % (key, old_inv[key], new_inv[key]))
    return out


def learn(report_path, repo, base, ours, ledger_path, profile=None, allow_weaken=False, reason=None, at=None):
    """Refresh auto entries for paths named in a step report. Owner entries are never touched."""
    with open(report_path, "r", encoding="utf-8") as fh:
        report = json.load(fh)
    raw_files = report.get("files", report) if isinstance(report, dict) else report
    paths = set()
    for item in raw_files:
        paths.add(item["path"] if isinstance(item, dict) else str(item))
    existing = C.load_ledger(ledger_path) if os.path.isfile(ledger_path) else {"entries": []}
    new = build(repo, base, ours, profile, sorted(paths), at, existing)
    old_by_key = {}
    for entry in existing.get("entries", []):
        if entry.get("auto", True):
            old_by_key[(entry["glob"], entry["invariant"]["type"])] = entry
    weaker = []
    for entry in new["entries"]:
        old = old_by_key.get((entry["glob"], entry["invariant"]["type"]))
        if old is None or not entry.get("auto", True):
            continue
        diffs = _weakened(old["invariant"], entry["invariant"])
        if diffs:
            weaker.append((entry["id"], diffs))
    if weaker and not allow_weaken:
        raise WeakenError("refusing to weaken invariants: %s (use --allow-weaken --reason)" % weaker)
    if weaker and not reason:
        raise WeakenError("--allow-weaken needs --reason")
    if weaker:
        for entry in new["entries"]:
            for eid, _ in weaker:
                if entry["id"] == eid:
                    entry["weaken_reason"] = reason
    return new, weaker


def _write(ledger, out_path):
    C.dump_yaml(ledger, out_path)


def cmd_ledger_gen(args):
    repo = args.repo or args.tree
    profile = C.load_profile(args.profile) if args.profile else None
    out_path = args.out
    existing = None
    if args.merge_existing and out_path and os.path.isfile(out_path):
        existing = C.load_ledger(out_path)
    ledger = build(repo, args.base, args.ours, profile, None, args.at, existing)
    if out_path:
        _write(ledger, out_path)
    counts = {}
    for entry in ledger["entries"]:
        counts[entry["category"]] = counts.get(entry["category"], 0) + 1
    summary = {"entries": len(ledger["entries"]), "by_category": counts, "out": out_path}
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    else:
        print("ledger-gen: %d entries -> %s" % (len(ledger["entries"]), out_path or "(stdout)"))
        for cat in sorted(counts):
            print("  %-16s %d" % (cat, counts[cat]))
    return 0


def cmd_learn(args):
    repo = args.repo or args.tree
    prof_path = args.profile or os.path.join(args.tree, ".fork-sync", "profile.yaml")
    if not os.path.isfile(prof_path):
        raise C.SchemaError("learn needs a profile (--profile or %s): without it locale entries are dropped" % prof_path)
    profile = C.load_profile(prof_path)
    try:
        ledger, weaker = learn(
            args.after_step,
            repo,
            args.base,
            args.ours,
            args.ledger,
            profile,
            allow_weaken=args.allow_weaken,
            reason=args.reason,
            at=args.at,
        )
    except WeakenError as exc:
        print("forksync learn: %s" % exc)
        return 2
    _write(ledger, args.ledger)
    print("learn: %d entries written, %d weakened (allowed)" % (len(ledger["entries"]), len(weaker)))
    return 0


def register(sub, common_args):
    p = sub.add_parser("ledger-gen", help="generate ledger from base..ours")
    common_args(p)
    p.add_argument("--base", required=True)
    p.add_argument("--ours", required=True)
    p.add_argument("--repo", default=None, help="unit repo dir (default --tree)")
    p.add_argument("--out", default=None, help="ledger file to write")
    p.add_argument("--merge-existing", action="store_true")
    p.add_argument("--at", default=None, help="fixed timestamp for stable output")
    p.set_defaults(func=cmd_ledger_gen)

    q = sub.add_parser("learn", help="refresh auto ledger entries after a step")
    common_args(q)
    q.add_argument("--after-step", required=True, help="step report JSON with files list")
    q.add_argument("--ledger", required=True)
    q.add_argument("--base", required=True)
    q.add_argument("--ours", required=True)
    q.add_argument("--repo", default=None)
    q.add_argument("--allow-weaken", action="store_true")
    q.add_argument("--reason", default=None)
    q.add_argument("--at", default=None)
    q.set_defaults(func=cmd_learn)
