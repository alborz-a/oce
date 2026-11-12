"""guard: evaluate ledger invariants against a tree. Pure: no network, no model.

Exit codes (set in forksync.py): 0 all PASS, 1 any FAIL or regression, 2 usage/schema error.
"""
import hashlib
import json
import os
import re

from . import common as C

SNIPPET = 120


def _read_bytes(tree, path):
    full = os.path.join(tree, path)
    if not os.path.isfile(full):
        return None
    with open(full, "rb") as fh:
        return fh.read()


def _text(data):
    return data.decode("utf-8", errors="replace")


def _norm_lines(text):
    return set(" ".join(line.split()) for line in text.splitlines())


def _pointer_get(obj, pointer):
    """RFC 6901 JSON pointer lookup. Raises KeyError when missing."""
    if pointer in ("", "/"):
        return obj
    cur = obj
    for raw in pointer.lstrip("/").split("/"):
        part = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(cur, list):
            cur = cur[int(part)]
        elif isinstance(cur, dict):
            cur = cur[part]
        else:
            raise KeyError(part)
    return cur


def _css_rule_present(text, selector_part, prop):
    """True when a rule whose selector contains selector_part declares prop."""
    prop_re = re.compile(r"(^|[;\s{])" + re.escape(prop) + r"\s*:", re.MULTILINE)
    for brace in re.finditer(r"\{", text):
        start = max(text.rfind("}", 0, brace.start()), text.rfind(";", 0, brace.start())) + 1
        selector = text[start:brace.start()]
        if selector_part not in selector:
            continue
        end = text.find("}", brace.end())
        body = text[brace.end(): end if end != -1 else len(text)]
        if prop_re.search(body):
            return True
    return False


def evaluate(entry, tree):
    """Evaluate one ledger entry. Returns a result dict with category and glob."""
    rid = entry["id"]
    inv = entry["invariant"]
    kind = inv["type"]
    path = inv.get("path", entry.get("glob", ""))
    out = None
    try:
        out = _evaluate_kind(rid, kind, inv, path, tree)
    except Exception as exc:  # any parse/IO problem is a FAIL, never a crash
        out = C.result(rid, False, "error: %s" % exc)
    out["category"] = entry.get("category", "")
    out["glob"] = entry.get("glob", path)
    out["type"] = kind
    return out


OFFENDER_LIMIT = 10


def _offenders(parsed, short, low_farsi):
    """Name the keys behind a locale_keys FAIL: keys with no Farsi, plus the shortfall in key count."""
    parts = []
    if short:
        parts.append("key count short (missing keys not named: no source file in invariant)")
    if low_farsi:
        english = ["%s (english)" % k for k, v in sorted(parsed.items()) if not C.has_farsi(v)]
        parts.append("%d key(s) without farsi: %s" % (len(english), ", ".join(english[:OFFENDER_LIMIT]) or "none"))
    return "; " + "; ".join(parts) if parts else ""


def _evaluate_kind(rid, kind, inv, path, tree):
    data = _read_bytes(tree, path)
    exists = data is not None
    if kind == "file_exists":
        return C.result(rid, exists, "present" if exists else "missing: " + path)
    if kind == "file_absent":
        return C.result(rid, not exists, "absent" if not exists else "came back: " + path)
    if not exists:
        return C.result(rid, False, "missing file: " + path)
    text = _text(data)
    if kind == "lines_present":
        wanted = [" ".join(x.split()) for x in inv["lines"]]
        wanted = [x for x in wanted if x]
        have = _norm_lines(text)
        present = sum(1 for x in wanted if x in have)
        frac = present / float(len(wanted)) if wanted else 1.0
        ok = frac + 1e-9 >= inv.get("min_fraction", 1.0)
        missing = [x for x in wanted if x not in have][:2]
        detail = "%d/%d lines present" % (present, len(wanted))
        if missing:
            detail += "; missing e.g. " + " | ".join(m[:SNIPPET] for m in missing)
        return C.result(rid, ok, detail)
    if kind == "file_lines":
        have = _norm_lines(text)
        wanted = [x for x in (" ".join(y.split()) for y in inv.get("lines", [])) if x]
        back = [x for x in (" ".join(y.split()) for y in inv.get("absent", [])) if x and x in have]
        missing = [x for x in wanted if x not in have]
        ok = not missing and not back
        detail = "%d/%d lines present, %d absent lines back" % (len(wanted) - len(missing), len(wanted), len(back))
        if missing:
            detail += "; missing e.g. " + missing[0][:SNIPPET]
        return C.result(rid, ok, detail)
    if kind == "lines_absent":
        have = _norm_lines(text)
        back = [" ".join(x.split()) for x in inv["lines"]]
        back = [x for x in back if x and x in have]
        detail = "0 lines back" if not back else "%d lines back e.g. %s" % (len(back), back[0][:SNIPPET])
        return C.result(rid, not back, detail)
    if kind == "regex_present":
        ok = re.search(inv["pattern"], text, re.MULTILINE) is not None
        return C.result(rid, ok, "pattern found" if ok else "pattern missing")
    if kind == "regex_absent":
        ok = re.search(inv["pattern"], text, re.MULTILINE) is None
        return C.result(rid, ok, "pattern absent" if ok else "pattern found (forbidden)")
    if kind == "locale_keys":
        parsed = C.parse_locale(text, inv["format"])
        values = list(parsed.values())
        farsi = sum(1 for v in values if C.has_farsi(v))
        frac = farsi / float(len(values)) if values else 0.0
        need_keys = inv.get("min_keys", 0)
        need_frac = inv.get("require_farsi_fraction", 0.0)
        ok = len(values) >= need_keys and frac + 1e-9 >= need_frac
        detail = "keys %d (min %d), farsi %.4f (min %.4f)" % (len(values), need_keys, frac, need_frac)
        if not ok:
            detail += _offenders(parsed, len(values) < need_keys, frac + 1e-9 < need_frac)
        return C.result(rid, ok, detail)
    if kind == "locale_key_values":
        parsed = C.parse_locale(text, inv.get("format", "yaml"))
        bad = [k for k, v in sorted(inv["keys"].items()) if parsed.get(k) != v]
        detail = "all %d pinned keys match" % len(inv["keys"]) if not bad else "mismatch: " + ", ".join(bad[:5])
        return C.result(rid, not bad, detail)
    if kind == "json_path_equals":
        doc = json.loads(text)
        try:
            got = _pointer_get(doc, inv["pointer"])
        except (KeyError, IndexError, ValueError):
            return C.result(rid, False, "pointer missing: " + inv["pointer"])
        ok = got == inv["value"]
        return C.result(rid, ok, "value ok" if ok else "got %r, want %r" % (got, inv["value"]))
    if kind == "css_rule_present":
        ok = _css_rule_present(text, inv["selector_contains"], inv["property"])
        return C.result(rid, ok, "rule ok" if ok else "no rule %s / %s" % (inv["selector_contains"], inv["property"]))
    if kind == "hash_equals":
        digest = hashlib.sha256(data).hexdigest()
        ok = digest == inv["sha256"]
        return C.result(rid, ok, "hash ok" if ok else "hash " + digest)
    return C.result(rid, False, "unknown invariant type: " + kind)


def run_ledger(ledger, tree, unit=""):
    """Evaluate all entries. Returns results sorted by id, each tagged with unit."""
    results = []
    for entry in sorted(ledger.get("entries", []), key=lambda e: e["id"]):
        res = evaluate(entry, tree)
        res["unit"] = unit
        results.append(res)
    return results


def summarize(results):
    """Per-category pass/fail counts."""
    cats = {}
    for res in results:
        row = cats.setdefault(res.get("category", ""), {"PASS": 0, "FAIL": 0})
        row[res["status"]] += 1
    return cats


def regressions(current, baseline):
    """Entries that PASSED in baseline and now FAIL or are missing."""
    now = {(r.get("unit", ""), r["id"]): r for r in current}
    out = []
    for old in baseline:
        if old.get("status") != "PASS":
            continue
        key = (old.get("unit", ""), old["id"])
        cur = now.get(key)
        if cur is None:
            out.append({"id": old["id"], "unit": key[0], "why": "missing"})
        elif cur["status"] == "FAIL":
            out.append({"id": old["id"], "unit": key[0], "why": cur["detail"]})
    return out


def load_baseline(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("results", []) if isinstance(data, dict) else data


def format_text(results, summary, regress):
    lines = []
    for res in results:
        lines.append("%s %s %s %s — %s" % (res["status"], res["unit"] or "-", res["id"], res["category"], res["detail"]))
    lines.append("")
    lines.append("summary:")
    for cat in sorted(summary):
        lines.append("  %-16s PASS %d  FAIL %d" % (cat, summary[cat]["PASS"], summary[cat]["FAIL"]))
    if regress:
        lines.append("regressions (PASS in baseline, now FAIL/missing):")
        for item in regress:
            lines.append("  %s %s: %s" % (item["unit"] or "-", item["id"], item["why"]))
    return "\n".join(lines)


def resolve_units(profile, tree):
    """(unit name, unit root dir, ledger path) for each profile unit."""
    out = []
    for unit in profile["units"]:
        root = os.path.join(tree, unit["path"])
        out.append((unit["name"], root, os.path.join(root, unit["ledger"])))
    return out


def cmd_guard(args):
    tree = os.path.abspath(args.tree)
    jobs = []
    if args.ledger:
        jobs.append(("", tree, os.path.abspath(args.ledger)))
    else:
        profile_path = args.profile or os.path.join(tree, ".fork-sync", "profile.yaml")
        profile = C.load_profile(profile_path)
        jobs = resolve_units(profile, tree)
    results = []
    for name, root, ledger_path in jobs:
        if not os.path.isfile(ledger_path):
            raise C.SchemaError("ledger missing: %s" % ledger_path)
        ledger = C.load_ledger(ledger_path)
        results.extend(run_ledger(ledger, root, name))
    summary = summarize(results)
    regress = []
    if args.compare:
        regress = regressions(results, load_baseline(args.compare))
    if args.baseline_json:
        with open(args.baseline_json, "w", encoding="utf-8") as fh:
            json.dump({"results": results}, fh, ensure_ascii=False, indent=2, sort_keys=True)
    failed = [r for r in results if r["status"] == "FAIL"]
    if args.json:
        payload = {"results": results, "summary": summary, "regressions": regress}
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(format_text(results, summary, regress))
    return 1 if (failed or regress) else 0


def register(sub, common_args):
    p = sub.add_parser("guard", help="check every ledger invariant against the tree")
    common_args(p)
    p.add_argument("--ledger", default=None, help="single ledger file (tree = --tree)")
    p.add_argument("--baseline-json", default=None, help="write results JSON here")
    p.add_argument("--compare", default=None, help="baseline results JSON; PASS->FAIL is a regression")
    p.set_defaults(func=cmd_guard)
