#!/bin/sh
# Copy the Mizito frontend mirror (third-party assets, not committed) into ./mirror, skipping *.bak* files.
# Usage: fetch-mirror.sh <source-dir>
set -eu
SRC="${1:-/mnt/archive/tmp/mizito-c-spike-w2/mirror}"; DST="$(dirname "$0")/../mirror"
mkdir -p "$DST"; tar -C "$SRC" --exclude='*.bak*' -cf - . | tar -C "$DST" -xf -
