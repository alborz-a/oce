"""profile-check: validate .fork-sync/profile.yaml and every unit ledger against the schema."""
import json
import os

from . import common as C


def resolve_profile_path(args):
    return args.profile or os.path.join(args.tree, ".fork-sync", "profile.yaml")


def check(profile_path, tree):
    """Return a list of result dicts. Raises SchemaError when the profile itself is invalid."""
    profile = C.load_profile(profile_path)
    results = [
        C.result(
            "profile",
            True,
            "schema ok: %d unit(s), %d locale spec(s)" % (len(profile["units"]), len(profile["locales"])),
        )
    ]
    for unit in profile["units"]:
        rid = "unit:" + unit["name"]
        root = os.path.join(tree, unit["path"])
        if not os.path.isdir(root):
            results.append(C.result(rid, False, "unit path missing: " + root))
            continue
        ledger_path = os.path.join(root, unit["ledger"])
        if not os.path.isfile(ledger_path):
            results.append(C.result(rid, False, "ledger missing: " + ledger_path))
            continue
        try:
            ledger = C.load_ledger(ledger_path)
        except C.SchemaError as exc:
            results.append(C.result(rid, False, str(exc)))
            continue
        results.append(C.result(rid, True, "%d entries" % len(ledger["entries"])))
    for loc in profile["locales"]:
        results.append(C.result("locale:" + loc["glob"], True, "%s, %s->%s" % (loc["format"], loc["source_lang"], loc["target_lang"])))
    return results


def cmd_profile_check(args):
    path = resolve_profile_path(args)
    try:
        results = check(path, os.path.abspath(args.tree))
    except (C.SchemaError, OSError) as exc:
        print("profile-check: %s" % exc)
        return 2
    bad = [r for r in results if r["status"] == "FAIL"]
    if args.json:
        print(json.dumps({"results": results, "ok": not bad}, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(C.format_results(results))
    return 2 if bad else 0


def register(sub, common_args):
    p = sub.add_parser("profile-check", help="validate profile and unit ledgers")
    common_args(p)
    p.set_defaults(func=cmd_profile_check)
