#!/usr/bin/env bash
# Runs the FULL test suite — every unit test in tests/*.test.js plus every
# integration test in tests/integration/*.test.js.
#
# Usage:
#   ./run-all-tests.sh                # run everything
#   ./run-all-tests.sh --coverage     # any extra args are passed straight to jest

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)/_common.sh"

if [ ! -d node_modules ]; then
  echo "node_modules not found — running npm install first..."
  npm install
fi

echo "==> Running full test suite (unit + integration) from $PROJECT_ROOT"
export NODE_OPTIONS="${NODE_OPTIONS:-} --experimental-vm-modules"
export WSLENV="${WSLENV:+$WSLENV:}NODE_OPTIONS"
npx jest "$@"