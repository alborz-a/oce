#!/usr/bin/env python3
"""Convert Tailwind physical utilities to logical ones (RTL-safe).

Dry-run by default; pass --write to modify files.
  python3 scripts/rtl_codemod.py [--write] [root ...]   (default root: frontend/src)

Requires tailwindcss >= 3.3 (frontend/package.json has ^3.4) for ms/me/ps/pe,
start-/end-, text-start/end, rounded-s/e/ss/se/es/ee, border-s/e.

Rules: variant prefixes and `!` / `-` forms are preserved. A string literal that
contains any rtl:/ltr: token is skipped entirely. left-/right- are skipped when
the same string has translate-x (centering trick does not flip). Only string
literals whose whitespace tokens all look like class names are touched.
"""
import re
import sys
from pathlib import Path

# Folders/files that carry physical (semantic) geometry and must not be flipped.
EXCLUDED_DIR_NAMES = {
    'bim', 'bim_requirements', 'BIMViewer', 'ProjectMap', 'Gantt', 'timeline',
    'schedule', 'schedule-advanced', 'rebar-schedule', 'canvas', 'pointcloud',
    'cad-explorer', 'dwg-takeoff', 'geo-hub', 'locales', '__tests__',
}
EXCLUDED_FILE_RE = re.compile(
    r'(Chart|Canvas|Viewer|Map|Editor|Gantt|Timeline|Schedule|Code|3D|Bim|BIM|\.test\.|\.spec\.)')

SPACING = {'ml': 'ms', 'mr': 'me', 'pl': 'ps', 'pr': 'pe', 'left': 'start', 'right': 'end'}
ROUNDED = {'l': 's', 'r': 'e', 'tl': 'ss', 'tr': 'se', 'bl': 'es', 'br': 'ee'}

TOKEN_OK = re.compile(r"^[!\-\w\[\]:/.%()#,&>*@=_~+$]+$")


def split_variants(tok):
    """Split on ':' outside [] -> (variants list, base)."""
    parts, depth, cur = [], 0, ''
    for ch in tok:
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        if ch == ':' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    return parts, cur


def convert_base(base, allow_inset):
    m = re.match(r'^(!?)(-?)(.*?)(!?)$', base)
    bang, neg, core, tail = m.groups()
    out = None
    m2 = re.match(r'^(ml|mr|pl|pr)-(.+)$', core)
    if m2:
        out = f'{SPACING[m2.group(1)]}-{m2.group(2)}'
    elif allow_inset and (m2 := re.match(r'^(left|right)-(.+)$', core)):
        out = f'{SPACING[m2.group(1)]}-{m2.group(2)}'
    elif core == 'text-left':
        out = 'text-start'
    elif core == 'text-right':
        out = 'text-end'
    elif (m2 := re.match(r'^rounded-(l|r|tl|tr|bl|br)(-.+)?$', core)):
        out = f'rounded-{ROUNDED[m2.group(1)]}{m2.group(2) or ""}'
    elif (m2 := re.match(r'^border-(l|r)(-.+)?$', core)):
        out = f'border-{"s" if m2.group(1) == "l" else "e"}{m2.group(2) or ""}'
    if out is None:
        return None
    return f'{bang}{neg}{out}{tail}'


def convert_class_string(s):
    toks = s.split()
    if not toks or not all(TOKEN_OK.match(t) for t in toks):
        return s
    parsed = [split_variants(t) for t in toks]
    if any(v in ('rtl', 'ltr') for vs, _ in parsed for v in vs):
        return s
    allow_inset = not any('translate-x' in b for _, b in parsed)
    changed = False
    out = s
    # Rebuild preserving original whitespace by regex sub per token.
    def repl(mt):
        nonlocal changed
        tok = mt.group(0)
        vs, base = split_variants(tok)
        nb = convert_base(base, allow_inset)
        if nb is None or nb == base:
            return tok
        changed = True
        return ''.join(v + ':' for v in vs) + nb
    out = re.sub(r'\S+', repl, s)
    return out if changed else s


STR_RE = re.compile(r'"([^"\\\n]*)"|\'([^\'\\\n]*)\'|`([^`\\]*)`')
TPL_SPLIT = re.compile(r'(\$\{[^{}]*\})')


def process_text(text):
    n = 0

    def sub(m):
        nonlocal n
        if m.group(1) is not None:
            new, q = convert_class_string(m.group(1)), '"'
        elif m.group(2) is not None:
            new, q = convert_class_string(m.group(2)), "'"
        else:
            body = m.group(3)
            pieces = TPL_SPLIT.split(body)
            new = ''.join(p if p.startswith('${') else convert_class_string(p) for p in pieces)
            q = '`'
        old = m.group(0)
        res = q + new + q
        if res != old:
            n += 1
        return res

    return STR_RE.sub(sub, text), n


def excluded(path):
    if any(part in EXCLUDED_DIR_NAMES for part in path.parts):
        return True
    return bool(EXCLUDED_FILE_RE.search(path.name))


def main():
    args = sys.argv[1:]
    write = '--write' in args
    roots = [Path(a) for a in args if not a.startswith('--')] or [Path('frontend/src')]
    files = changed_strings = 0
    for root in roots:
        for p in sorted(root.rglob('*.tsx')):
            if excluded(p):
                continue
            with open(p, encoding='utf-8', newline='') as fh:
                src = fh.read()
            new, n = process_text(src)
            if n:
                files += 1
                changed_strings += n
                print(f'{p}: {n}')
                if write:
                    with open(p, 'w', encoding='utf-8', newline='') as fh:
                        fh.write(new)
    print(f'{"WROTE" if write else "DRY-RUN"}: {files} files, {changed_strings} strings')


if __name__ == '__main__':
    main()
