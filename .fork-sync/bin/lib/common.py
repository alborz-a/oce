"""Shared helpers for forksync: git, YAML/JSON I/O, profile/ledger loading, locale parsing, globs.

Contract used by every other lib module. Keep these signatures stable.
"""
import json
import os
import re
import subprocess

import yaml

ARABIC_SCRIPT_RE = re.compile(
    "[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]"
)
LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)

LOCALE_FORMATS = ("yaml", "json", "ts-object")
PROFILE_BASE_MODES = ("merge-base", "explicit-tag")
LEDGER_CATEGORIES = (
    "translation",
    "rtl",
    "iran-lock",
    "branding",
    "access",
    "removed-feature",
    "bugfix",
    "fork-only",
)
INVARIANT_TYPES = (
    "file_exists",
    "file_absent",
    "lines_present",
    "lines_absent",
    "regex_present",
    "regex_absent",
    "locale_keys",
    "locale_key_values",
    "json_path_equals",
    "css_rule_present",
    "hash_equals",
)
DEFAULT_FARSI_REGEX = ARABIC_SCRIPT_RE.pattern
# Generated, vendored and build-output paths: never classified into the ledger.
DEFAULT_IGNORE = [
    "**/*.lock",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/composer.lock",
    "**/poetry.lock",
    "**/vendor/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.map",
    "**/generated/**",
]
DEFAULT_FAIL_ON = [
    "translation",
    "rtl",
    "iran-lock",
    "branding",
    "access",
    "removed-feature",
    "bugfix",
]


class SchemaError(ValueError):
    """Profile or ledger does not match its documented schema."""


# ---------------------------------------------------------------- git


def run_git(args, cwd, check=True):
    """Run `git args` in cwd, return stdout text. Raise RuntimeError on failure when check."""
    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        raise RuntimeError(
            "git %s failed (%d): %s" % (" ".join(args), proc.returncode, proc.stderr.strip())
        )
    return proc.stdout


def show_file(ref, path, cwd):
    """Return bytes of path at ref, or None when it does not exist there."""
    proc = subprocess.run(
        ["git", "show", "%s:%s" % (ref, path)],
        cwd=cwd,
        capture_output=True,
    )
    if proc.returncode != 0:
        return None
    return proc.stdout


# ---------------------------------------------------------------- YAML / JSON


def load_yaml(path):
    """Load a YAML file into a dict. Empty file gives {}."""
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise SchemaError("%s: top level must be a mapping" % path)
    return data


def dump_yaml(obj, path):
    """Write obj as stable YAML (insertion order kept, unicode kept)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(
            obj,
            fh,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
            width=1000,
        )


# ---------------------------------------------------------------- profile


def _require(mapping, key, where, kind=None):
    if not isinstance(mapping, dict) or key not in mapping:
        raise SchemaError("%s: missing required key '%s'" % (where, key))
    value = mapping[key]
    if kind is not None and not isinstance(value, kind):
        raise SchemaError("%s: '%s' must be %s" % (where, key, kind.__name__))
    return value


def load_profile(path):
    """Load and validate .fork-sync/profile.yaml. Defaults are filled in.

    Raises SchemaError on any missing or wrong-typed required key.
    """
    raw = load_yaml(path)
    _require(raw, "project", "profile", str)

    upstream = _require(raw, "upstream", "profile", dict)
    _require(upstream, "url", "profile.upstream", str)
    upstream.setdefault("remote_name", "upstream")
    upstream.setdefault("default_branch", "main")
    upstream.setdefault("tag_regex", r"^v\d+\.\d+\.\d+$")

    ours = _require(raw, "ours", "profile", dict)
    _require(ours, "branch", "profile.ours", str)

    base = _require(raw, "base", "profile", dict)
    mode = _require(base, "mode", "profile.base", str)
    if mode not in PROFILE_BASE_MODES:
        raise SchemaError("profile.base.mode must be one of %s" % ", ".join(PROFILE_BASE_MODES))
    if mode == "explicit-tag":
        _require(base, "ref", "profile.base", str)
    base.setdefault("ref", None)

    units = raw.get("units")
    if units is None:
        units = [{"name": raw["project"], "path": ".", "ledger": ".fork-sync/ledger.yaml"}]
    if not isinstance(units, list) or not units:
        raise SchemaError("profile.units must be a non-empty list")
    for idx, unit in enumerate(units):
        where = "profile.units[%d]" % idx
        _require(unit, "name", where, str)
        _require(unit, "path", where, str)
        _require(unit, "ledger", where, str)
        unit.setdefault("upstream_url", None)
    raw["units"] = units

    locales = raw.get("locales") or []
    for idx, loc in enumerate(locales):
        where = "profile.locales[%d]" % idx
        _require(loc, "glob", where, str)
        fmt = _require(loc, "format", where, str)
        if fmt not in LOCALE_FORMATS:
            raise SchemaError("%s: format must be one of %s" % (where, ", ".join(LOCALE_FORMATS)))
        loc.setdefault("source_lang", "en")
        loc.setdefault("target_lang", "fa")
        loc.setdefault("key_style", "nested")
    raw["locales"] = locales

    rtl = raw.get("rtl") or {}
    rtl.setdefault("css_globs", [])
    rtl.setdefault("required_snippets", [])
    raw["rtl"] = rtl

    iran = raw.get("iran_lock") or {}
    iran.setdefault("removed_pickers", [])
    iran.setdefault("forced_values", {})
    raw["iran_lock"] = iran

    guard = raw.get("guard") or {}
    guard.setdefault("fail_on", list(DEFAULT_FAIL_ON))
    guard.setdefault("farsi_regex", DEFAULT_FARSI_REGEX)
    guard.setdefault("ignore", list(DEFAULT_IGNORE))
    raw["guard"] = guard

    sync = raw.get("sync") or {}
    sync.setdefault("step_unit", "release-tag")
    sync.setdefault("max_files_per_step_warn", 200)
    sync.setdefault("worktree_root", "")
    raw["sync"] = sync
    return raw


# ---------------------------------------------------------------- ledger


def load_ledger(path):
    """Load and structurally validate a ledger. Deep invariant checks live in ledger.py."""
    raw = load_yaml(path)
    if raw.get("version") != 1:
        raise SchemaError("%s: version must be 1" % path)
    entries = raw.get("entries")
    if entries is None:
        entries = []
    if not isinstance(entries, list):
        raise SchemaError("%s: entries must be a list" % path)
    seen = set()
    for idx, entry in enumerate(entries):
        where = "%s entries[%d]" % (path, idx)
        eid = _require(entry, "id", where, str)
        if eid in seen:
            raise SchemaError("%s: duplicate id %s" % (where, eid))
        seen.add(eid)
        _require(entry, "glob", where, str)
        category = _require(entry, "category", where, str)
        if category not in LEDGER_CATEGORIES:
            raise SchemaError("%s: unknown category '%s'" % (where, category))
        inv = _require(entry, "invariant", where, dict)
        itype = _require(inv, "type", where + ".invariant", str)
        if itype not in INVARIANT_TYPES:
            raise SchemaError("%s: unknown invariant type '%s'" % (where, itype))
        entry.setdefault("intent", "")
        entry.setdefault("auto", True)
    raw["entries"] = entries
    return raw


# ---------------------------------------------------------------- Farsi


def has_farsi(s):
    """True when s contains at least one Arabic-script character."""
    return bool(ARABIC_SCRIPT_RE.search(s or ""))


def farsi_ratio(s):
    """Farsi chars divided by letter chars in s. 0.0 when s has no letters."""
    text = s or ""
    letters = LETTER_RE.findall(text)
    if not letters:
        return 0.0
    farsi = sum(1 for ch in letters if ARABIC_SCRIPT_RE.match(ch))
    return farsi / float(len(letters))


# ---------------------------------------------------------------- locale parsing


def _flatten(obj, prefix, out):
    if isinstance(obj, dict):
        for key in obj:
            child = "%s.%s" % (prefix, key) if prefix else str(key)
            _flatten(obj[key], child, out)
    elif isinstance(obj, str):
        out[prefix] = obj


def _parse_yaml_locale(text):
    data = yaml.safe_load(text) or {}
    out = {}
    _flatten(data, "", out)
    return out


def _parse_json_locale(text):
    data = json.loads(text) if text.strip() else {}
    out = {}
    _flatten(data, "", out)
    return out


def _ts_strip_comments(text):
    """Remove // and /* */ comments that sit outside string literals."""
    out = []
    i = 0
    n = len(text)
    quote = None
    while i < n:
        ch = text[i]
        if quote:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            out.append(ch)
            i += 1
            continue
        if text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end == -1 else end
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end == -1 else end + 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


_TS_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "'": "'", '"': '"', "`": "`", "\\": "\\", "/": "/"}


class _TsObjectReader(object):
    """Tolerant reader for one JS object literal starting at a '{'.

    Extracts string-valued key paths. Skips non-string values (arrays, numbers,
    calls, identifiers, template literals with ${}) without failing.
    Limits: no computed keys, no spread, no string concatenation with +
    (the value is skipped), no template interpolation (value skipped).
    """

    def __init__(self, text, pos):
        self.text = text
        self.pos = pos
        self.n = len(text)

    def _skip_ws(self):
        while self.pos < self.n and self.text[self.pos] in " \t\r\n,;":
            self.pos += 1

    def _read_string(self):
        quote = self.text[self.pos]
        self.pos += 1
        buf = []
        interpolated = False
        while self.pos < self.n:
            ch = self.text[self.pos]
            if ch == "\\" and self.pos + 1 < self.n:
                nxt = self.text[self.pos + 1]
                if nxt == "u":
                    hexpart = self.text[self.pos + 2:self.pos + 6]
                    if re.fullmatch(r"[0-9a-fA-F]{4}", hexpart):
                        buf.append(chr(int(hexpart, 16)))
                        self.pos += 6
                        continue
                buf.append(_TS_ESCAPES.get(nxt, nxt))
                self.pos += 2
                continue
            if quote == "`" and ch == "$" and self.pos + 1 < self.n and self.text[self.pos + 1] == "{":
                interpolated = True
            if ch == quote:
                self.pos += 1
                return None if interpolated else "".join(buf)
            buf.append(ch)
            self.pos += 1
        return None

    def _skip_balanced(self):
        """Skip one value token group until ',' or '}' at depth 0 (not consumed)."""
        depth = 0
        while self.pos < self.n:
            ch = self.text[self.pos]
            if ch in ("'", '"', "`"):
                self._read_string()
                continue
            if ch in "([{":
                depth += 1
            elif ch in ")]}":
                if depth == 0:
                    return
                depth -= 1
            elif ch == "," and depth == 0:
                return
            self.pos += 1

    def read_object(self, prefix, out):
        """Pos is on '{'. Fill out with dotted key -> string. Return after matching '}'."""
        self.pos += 1
        while True:
            self._skip_ws()
            if self.pos >= self.n:
                return
            ch = self.text[self.pos]
            if ch == "}":
                self.pos += 1
                return
            if ch in ("'", '"', "`"):
                key = self._read_string()
            else:
                m = re.compile(r"[A-Za-z_$0-9][\w$.-]*").match(self.text, self.pos)
                if not m:
                    self.pos += 1
                    continue
                key = m.group(0)
                self.pos = m.end()
            self._skip_ws()
            if self.pos < self.n and self.text[self.pos] == ":":
                self.pos += 1
                self._skip_ws()
            elif self.pos < self.n and self.text[self.pos] == "(":
                # method shorthand: skip the whole member
                self._skip_balanced()
                continue
            else:
                continue
            child = "%s.%s" % (prefix, key) if prefix else key
            self._skip_ws()
            if self.pos < self.n and self.text[self.pos] == "{":
                self.read_object(child, out)
                continue
            if self.pos < self.n and self.text[self.pos] in ("'", '"', "`"):
                value_start = self.pos
                value = self._read_string()
                while self.pos < self.n and self.text[self.pos] in " \t\r\n":
                    self.pos += 1
                # string followed by + or other operator: not a plain literal
                if self.pos < self.n and self.text[self.pos] not in ",}":
                    self.pos = value_start
                    self._skip_balanced()
                    continue
                if value is not None:
                    out[child] = value
                continue
            self._skip_balanced()


def _parse_ts_locale(text):
    clean = _ts_strip_comments(text)
    start = clean.find("{")
    out = {}
    if start == -1:
        return out
    _TsObjectReader(clean, start).read_object("", out)
    return out


def parse_locale(text, fmt):
    """Parse a locale file body into a flat {dotted.key: string} dict.

    fmt: 'yaml' | 'json' | 'ts-object'. Non-string leaves are dropped.
    ICU message strings are returned verbatim (opaque).
    """
    if fmt == "yaml":
        return _parse_yaml_locale(text)
    if fmt == "json":
        return _parse_json_locale(text)
    if fmt == "ts-object":
        return _parse_ts_locale(text)
    raise SchemaError("unsupported locale format: %s" % fmt)


# ---------------------------------------------------------------- globs


def _glob_to_regex(glob):
    out = []
    i = 0
    n = len(glob)
    while i < n:
        ch = glob[i]
        if glob.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif glob.startswith("**", i):
            out.append(".*")
            i += 2
        elif ch == "*":
            out.append("[^/]*")
            i += 1
        elif ch == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(ch))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def match_glob(path, glob):
    """Match a repo-relative posix path against a glob. Supports *, ?, and **."""
    return _glob_to_regex(glob).match(path.replace(os.sep, "/")) is not None


def locale_paths(profile, tree):
    """Return sorted repo-relative paths under tree matching any profile locale glob."""
    found = set()
    globs = [loc["glob"] for loc in profile.get("locales", [])]
    if not globs:
        return []
    for root, dirs, files in os.walk(tree):
        dirs[:] = sorted(d for d in dirs if d not in (".git", "node_modules"))
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, tree).replace(os.sep, "/")
            if any(match_glob(rel, g) for g in globs):
                found.add(rel)
    return sorted(found)


# ---------------------------------------------------------------- results


def result(rid, ok, detail=""):
    """Standard check result object."""
    return {"id": rid, "status": "PASS" if ok else "FAIL", "detail": detail}


def format_results(results):
    """One line per result: STATUS id — detail."""
    return "\n".join("%s %s — %s" % (r["status"], r["id"], r["detail"]) for r in results)
