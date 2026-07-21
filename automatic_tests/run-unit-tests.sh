#!/usr/bin/env bash
# Runs ONLY the unit tests directly under tests/*.test.js — the ones that
# call controllers/middleware/utils directly with fake req/res objects and
# mocked dependencies. Excludes tests/integration/.
#
# Usage:
#   ./run-unit-tests.sh                # run all unit tests
#   ./run-unit-tests.sh --watch        # any extra args are passed straight to jest

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d node_modules ]; then
  echo "node_modules not found — running npm install first..."
  npm install
fi

echo "==> Running unit tests only from $PROJECT_ROOT"
npx jest --testPathPatterns='tests/[^/]+\.test\.js$' "$@"
