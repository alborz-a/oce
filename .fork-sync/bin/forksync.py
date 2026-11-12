#!/usr/bin/env python3
"""forksync: keep a localized fork in sync with upstream, with proof that no fork edit is lost.

Run with: /home/alborz/.hermes/bin/uv run --with pyyaml python scripts/forksync.py <subcommand>

Exit codes: 0 ok, 1 guard FAIL or regression, 2 usage / schema / missing input.
Subcommands live in scripts/lib/<name>.py. Each module exposes
register(sub, common_args) that adds its subparser and sets func.
Optional modules (plan, analyze, step, translate_merge) are loaded when present.
"""
import argparse
import importlib
import inspect
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from lib import common as C  # noqa: E402
from lib import guard as G  # noqa: E402
from lib import ledger as L  # noqa: E402
from lib import profile as P  # noqa: E402

EXIT_OK = 0
EXIT_FAIL = 1
EXIT_USAGE = 2
OPTIONAL_MODULES = ("plan", "analyze", "step", "translate_merge")


def build_parser():
    ap = argparse.ArgumentParser(prog="forksync", description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", metavar="<subcommand>")
    sub.required = True

    def common_args(p):
        p.add_argument("--profile", default=None, help="profile.yaml (default <tree>/.fork-sync/profile.yaml)")
        p.add_argument("--tree", default=os.getcwd(), help="repo root (default cwd)")
        p.add_argument("--json", action="store_true", help="machine-readable output")

    P.register(sub, common_args)
    L.register(sub, common_args)
    G.register(sub, common_args)
    for name in OPTIONAL_MODULES:
        try:
            mod = importlib.import_module("lib." + name)
        except ImportError:
            continue
        # Optional modules may take (sub) or (sub, common_args); pass what they accept.
        if len(inspect.signature(mod.register).parameters) >= 2:
            mod.register(sub, common_args)
        else:
            mod.register(sub)
    return ap


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except (C.SchemaError, RuntimeError, OSError, ValueError) as exc:
        print("forksync: %s" % exc, file=sys.stderr)
        return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main())
