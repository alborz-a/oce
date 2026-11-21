#!/usr/bin/env bash
# Light fork guard: validates the profile and checks every ledger invariant
# against this tree. No build, no network, no model.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 .fork-sync/bin/forksync.py profile-check --profile .fork-sync/profile.yaml --tree .
python3 .fork-sync/bin/forksync.py guard --profile .fork-sync/profile.yaml --tree .
