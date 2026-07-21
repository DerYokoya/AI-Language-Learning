#!/usr/bin/env bash
# Runs ONLY the integration tests in tests/integration/*.test.js — the ones
# that drive the real Express app end-to-end via supertest (routes,
# middleware, cookies/JWT, rate limiters, error handler), with just the
# database and the AI client faked out.
#
# Usage:
#   ./run-integration-tests.sh                          # run all integration tests
#   ./run-integration-tests.sh -t "logs out"             # any extra args are passed straight to jest

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d node_modules ]; then
  echo "node_modules not found — running npm install first..."
  npm install
fi

echo "==> Running integration tests only from $PROJECT_ROOT"
npx jest tests/integration "$@"
