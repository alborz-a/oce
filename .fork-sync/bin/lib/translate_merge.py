"""translate-merge: key-wise three-way merge for locale files.

Rules (per dotted key; base=B, ours=O, theirs=T):
- O and T equal -> O.
- O has Farsi -> O (ours Farsi always wins).
- O unchanged from B, T changed -> T (new English goes to new-keys.json).
- O changed (non-Farsi) -> O.
- Key only in T (new upstream) -> T, listed in new-keys.json.
- Key deleted upstream, O unchanged -> dropped; O changed -> kept with warning.
- Key deleted in O, T changed -> stays deleted with warning.

ts-object output: ours text is kept as-is; new keys are NOT yet inserted
into the file (gap, see step report). Only new-keys.json is written for it.
"""
import argparse
import json
import os
import sys

from . import common as C


def _ordered_union(*dicts):
    seen = []
    known = set()
    for d in dicts:
        for key in d:
            if key not in known:
                known.add(key)
                seen.append(key)
    return seen


def merge_flat(base, ours, theirs):
    """Merge three flat {dotted.key: str} dicts.

    Returns (merged, new_keys, warnings). new_keys is a list of
    {"key", "value", "needs_translation"} dicts.
    """
    merged = {}
    new_keys = []
    warnings = []
    for key in _ordered_union(ours, theirs, base):
        has_b = key in base
        has_o = key in ours
        has_t = key in theirs
        b = base.get(key)
        o = ours.get(key)
        t = theirs.get(key)
        if has_o and has_t:
            if o == t:
                merged[key] = o
            elif C.has_farsi(o):
                merged[key] = o
            elif has_b and o == b:
                merged[key] = t
                if not C.has_farsi(t):
                    new_keys.append({"key": key, "value": t, "needs_translation": True})
            else:
                merged[key] = o
        elif has_o and not has_t:
            if has_b and o == b:
                continue  # upstream deleted it, ours untouched
            if has_b:
                warnings.append("%s: upstream deleted, ours changed; kept ours" % key)
            merged[key] = o
        elif has_t and not has_o:
            if not has_b:
                merged[key] = t
                new_keys.append({"key": key, "value": t, "needs_translation": not C.has_farsi(t)})
            elif t != b:
                warnings.append("%s: ours deleted, upstream changed; kept deleted" % key)
    return merged, new_keys, warnings


def _nest(flat):
    root = {}
    for key, value in flat.items():
        node = root
        parts = key.split(".")
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    return root


def _render(flat, fmt, key_style):
    if fmt == "json":
        data = flat if key_style == "flat" else _nest(flat)
        return json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if fmt == "yaml":
        import yaml

        data = flat if key_style == "flat" else _nest(flat)
        return yaml.safe_dump(
            data, sort_keys=False, allow_unicode=True, default_flow_style=False, width=1000
        )
    raise C.SchemaError("render unsupported for format %s" % fmt)


def _read(path):
    if path is None or not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def translate_merge(base_text, ours_text, theirs_text, fmt, key_style="nested"):
    """Merge locale texts. Returns (output_text, new_keys, warnings)."""
    if fmt == "ts-object":
        base = C.parse_locale(base_text, fmt) if base_text else {}
        ours = C.parse_locale(ours_text, fmt) if ours_text else {}
        theirs = C.parse_locale(theirs_text, fmt) if theirs_text else {}
        _merged, new_keys, warnings = merge_flat(base, ours, theirs)
        warnings.append("ts-object: ours text kept; new keys not inserted into file")
        return ours_text, new_keys, warnings
    base = C.parse_locale(base_text, fmt) if base_text else {}
    ours = C.parse_locale(ours_text, fmt) if ours_text else {}
    theirs = C.parse_locale(theirs_text, fmt) if theirs_text else {}
    merged, new_keys, warnings = merge_flat(base, ours, theirs)
    return _render(merged, fmt, key_style), new_keys, warnings


def register(subparsers, common_args=None):
    sp = subparsers.add_parser("translate-merge", help="key-wise 3-way merge of a locale file")
    sp.add_argument("--base", required=True, help="base locale file (may be missing)")
    sp.add_argument("--ours", required=True, help="our locale file")
    sp.add_argument("--theirs", required=True, help="upstream locale file")
    sp.add_argument("--format", required=True, choices=C.LOCALE_FORMATS)
    sp.add_argument("--key-style", default="nested", choices=("nested", "flat"))
    sp.add_argument("--out", required=True, help="merged output file")
    sp.add_argument("--new-keys", default=None, help="new-keys.json path (default: next to --out)")
    sp.add_argument("--json", action="store_true", help="print summary as JSON")
    sp.set_defaults(func=run)
    return sp


def run(args):
    try:
        text, new_keys, warnings = translate_merge(
            _read(args.base), _read(args.ours), _read(args.theirs), args.format, args.key_style
        )
    except (C.SchemaError, ValueError) as exc:
        sys.stderr.write("translate-merge: %s\n" % exc)
        return 2
    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(text)
    new_path = args.new_keys or os.path.join(out_dir, "new-keys.json")
    with open(new_path, "w", encoding="utf-8") as fh:
        json.dump({"format": args.format, "new_keys": new_keys}, fh, ensure_ascii=False, indent=2)
    summary = {
        "out": args.out,
        "new_keys": len(new_keys),
        "needs_translation": sum(1 for k in new_keys if k["needs_translation"]),
        "warnings": warnings,
    }
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print("translate-merge: %d new keys (%d need translation), %d warnings"
              % (summary["new_keys"], summary["needs_translation"], len(warnings)))
        for line in warnings:
            print("  warn: " + line)
    return 0
