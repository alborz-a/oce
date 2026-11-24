#!/bin/sh
# Fetch the static Mizito view templates the gateway needs but the mirror lacks (one GET each, no credentials) into ./mirror/views/partial.
# Usage: fetch-templates.sh [cache_id]   (default: read from mirror/index.html)
set -eu
D="$(cd "$(dirname "$0")/.." && pwd)"; V="${1:-$(grep -o 'c_\.js?v=[0-9.-]*' "$D/mirror/index.html" | head -1 | cut -d= -f2)}"
mkdir -p "$D/mirror/views/partial"
for n in entity-document entity-photo modal-file-uploader; do
  curl -fsS -m 20 -o "$D/mirror/views/partial/$n.html" "https://office.mizito.ir/views/partial/$n.html?v=$V" && echo "ok $n"
done
