#!/usr/bin/env python3
"""Deterministic Codemod: Physical to Logical Tailwind CSS classes for RTL support.

Converts physical direction classes (left/right) to logical equivalents (start/end)
in React/TSX files while preserving arbitrary prefixes (responsive, pseudo-class, etc.).

Mappings:
  ml- -> ms- (and -ml- -> -ms-)
  mr- -> me- (and -mr- -> -me-)
  pl- -> ps-
  pr- -> pe-
  left- -> start- (and -left- -> -start-)
  right- -> end- (and -right- -> -end-)
  text-left -> text-start
  text-right -> text-end
  rounded-l- -> rounded-s-
  rounded-r- -> rounded-e-
  rounded-l -> rounded-s
  rounded-r -> rounded-e
  border-l- -> border-s-
  border-r- -> border-e-
  border-l -> border-s
  border-r -> border-e

Exclusions:
  Semantic physical paths (charts, canvas, BIM/3D viewers, maps, Gantt timelines, code editors).
"""

import os
import re
import sys
from pathlib import Path

# Paths where physical direction is semantic and must NOT be converted
EXCLUDED_PATTERNS = [
    r"[\\/]bim[\\/]",
    r"[\\/]BIM[\\/]",
    r"BIMViewer",
    r"[\\/]cad[\\/]",
    r"CadLogin",
    r"CadFloorplan",
    r"CadBackground",
    r"[\\/]canvas[\\/]",
    r"[\\/]charts?[\\/]",
    r"[\\/]gantt[\\/]",
    r"[\\/]Gantt[\\/]",
    r"[\\/]maps?[\\/]",
    r"MapLibre",
    r"Cesium",
    r"[\\/]monaco[\\/]",
    r"[\\/]editor[\\/]",
    r"[\\/]timeline[\\/]",
    r"[\\/]three[\\/]",
]

EXCLUDE_REGEX = re.compile("|".join(EXCLUDED_PATTERNS), re.IGNORECASE)

# Prefix pattern: captures any chain of Tailwind prefixes (e.g., "dark:hover:", "sm:", "-")
# Delimiters before class: whitespace, quotes, backticks, { ( `
PREFIX_PATTERN = r"(?<=[\s'\"`{(:])(-?)"

# Mapping rules: tuple of (regex_pattern, replacement_function or string)
# Note: we work on individual class tokens in className strings or files.
RULES = [
    # text-left / text-right
    (r"(?<=[\s'\"`(:])text-left(?=[\s'\"`):])", r"text-start"),
    (r"(?<=[\s'\"`(:])text-right(?=[\s'\"`):])", r"text-end"),

    # margins: -?ml- -> -?ms-, -?mr- -> -?me-
    (r"(?<=[\s'\"`(:])(-?)ml-", r"\1ms-"),
    (r"(?<=[\s'\"`(:])(-?)mr-", r"\1me-"),

    # paddings: pl- -> ps-, pr- -> pe-
    (r"(?<=[\s'\"`(:])pl-", r"ps-"),
    (r"(?<=[\s'\"`(:])pr-", r"pe-"),

    # positions: -?left- -> -?start-, -?right- -> -?end-
    (r"(?<=[\s'\"`(:])(-?)left-", r"\1start-"),
    (r"(?<=[\s'\"`(:])(-?)right-", r"\1end-"),

    # borders: border-l- -> border-s-, border-r- -> border-e-
    (r"(?<=[\s'\"`(:])border-l-", r"border-s-"),
    (r"(?<=[\s'\"`(:])border-r-", r"border-e-"),
    (r"(?<=[\s'\"`(:])border-l(?=[\s'\"`):])", r"border-s"),
    (r"(?<=[\s'\"`(:])border-r(?=[\s'\"`):])", r"border-e"),

    # rounded: rounded-l- -> rounded-s-, rounded-r- -> rounded-e-
    (r"(?<=[\s'\"`(:])rounded-l-", r"rounded-s-"),
    (r"(?<=[\s'\"`(:])rounded-r-", r"rounded-e-"),
    (r"(?<=[\s'\"`(:])rounded-l(?=[\s'\"`):])", r"rounded-s"),
    (r"(?<=[\s'\"`(:])rounded-r(?=[\s'\"`):])", r"rounded-e"),
]

COMPILED_RULES = [(re.compile(pat), rep) for pat, rep in RULES]


def should_exclude(file_path: str) -> bool:
    norm = str(file_path).replace("/", os.sep)
    return bool(EXCLUDE_REGEX.search(norm))


def convert_content(content: str) -> tuple[str, int]:
    total_changes = 0
    modified = content
    for pattern, replacement in COMPILED_RULES:
        modified, count = pattern.subn(replacement, modified)
        total_changes += count
    return modified, total_changes


def process_file(file_path: Path, dry_run: bool = False) -> int:
    if should_exclude(str(file_path)):
        return 0

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return 0

    new_content, changes = convert_content(content)
    if changes > 0:
        if not dry_run:
            file_path.write_text(new_content, encoding="utf-8")
        print(f"  {file_path}: {changes} replacements")
    return changes


def process_path(target_path: Path, dry_run: bool = False) -> tuple[int, int]:
    files_changed = 0
    replacements = 0

    if target_path.is_file():
        if target_path.suffix in (".tsx", ".ts", ".jsx", ".js"):
            c = process_file(target_path, dry_run)
            if c > 0:
                files_changed += 1
                replacements += c
    elif target_path.is_dir():
        for ext in ("*.tsx", "*.ts", "*.jsx", "*.js"):
            for f in target_path.rglob(ext):
                if "node_modules" in f.parts or ".git" in f.parts or "dist" in f.parts:
                    continue
                c = process_file(f, dry_run)
                if c > 0:
                    files_changed += 1
                    replacements += c
    return files_changed, replacements


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Deterministic Tailwind physical-to-logical RTL codemod.")
    parser.add_argument("paths", nargs="+", help="Files or directories to process")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without modifying files")
    args = parser.parse_args()

    total_files = 0
    total_reps = 0

    for p_str in args.paths:
        p = Path(p_str)
        if not p.exists():
            print(f"Warning: path not found: {p}", file=sys.stderr)
            continue
        fc, rc = process_path(p, args.dry_run)
        total_files += fc
        total_reps += rc

    mode_str = " (DRY RUN)" if args.dry_run else ""
    print(f"\nCodemod complete{mode_str}: {total_reps} replacements across {total_files} files.")


if __name__ == "__main__":
    main()
