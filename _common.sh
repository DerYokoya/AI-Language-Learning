# Shared bootstrap, sourced (not run directly) by scripts in automatic_tests/
# and scripts/. Resolves the project root regardless of which folder the
# calling script lives in or what directory it was invoked from, then cds
# into it so every relative path in the calling script (.env, src/db/...,
# package.json, etc.) resolves consistently.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"