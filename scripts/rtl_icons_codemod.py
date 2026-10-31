#!/usr/bin/env python3
"""Add `rtl:rotate-180` to directional lucide icons (ChevronRight/Left, ArrowRight/Left).

Dry-run by default; --write to modify. Only handles icons whose own tag has a plain
className="..." attribute. Skips: excluded semantic paths (same list as rtl_codemod.py),
classes already containing rotate/rtl:/ltr:, and context lines (+-2) mentioning
undo/redo/play/sort/map/pan/zoom/carousel/slider.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from rtl_codemod import excluded  # noqa: E402

ICON_RE = re.compile(r'<(ChevronRight|ChevronLeft|ArrowRight|ArrowLeft)\b([^<>]*?)className="([^"]*)"')
ICON_ANY = re.compile(r'<(?:ChevronRight|ChevronLeft|ArrowRight|ArrowLeft)\b')
CTX_SKIP = re.compile(r'undo|redo|play|sort|\bmap\b|pan\b|zoom|carousel|slider|replay', re.I)


def main():
    args = sys.argv[1:]
    write = '--write' in args
    roots = [Path(a) for a in args if not a.startswith('--')] or [Path('frontend/src')]
    flipped = total = 0
    files = 0
    for root in roots:
        for p in sorted(root.rglob('*.tsx')):
            with open(p, encoding='utf-8', newline='') as fh:
                src = fh.read()
            n_any = len(ICON_ANY.findall(src))
            total += n_any
            if excluded(p) or not n_any:
                continue
            lines = src.split('\n')
            starts = [0]
            for ln in lines:
                starts.append(starts[-1] + len(ln) + 1)

            def sub(m):
                nonlocal flipped
                cls = m.group(3)
                if re.search(r'rotate|rtl:|ltr:', cls):
                    return m.group(0)
                li = max(0, next(i for i, s in enumerate(starts) if s > m.start()) - 1)
                ctx = '\n'.join(lines[max(0, li - 2):li + 3])
                if CTX_SKIP.search(ctx):
                    return m.group(0)
                flipped += 1
                new = (cls.rstrip() + ' rtl:rotate-180').strip()
                return m.group(0)[:m.start(3) - m.start()] + new + '"'

            new_src = ICON_RE.sub(sub, src)
            if new_src != src:
                files += 1
                if write:
                    with open(p, 'w', encoding='utf-8', newline='') as fh:
                        fh.write(new_src)
    print(f'{"WROTE" if write else "DRY-RUN"}: flipped={flipped} skipped={total - flipped} total={total} files={files}')


if __name__ == '__main__':
    main()
