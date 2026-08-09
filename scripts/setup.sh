#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_common.sh"

if [ ! -f .env ]; then
    cp .env.example .env
fi

bash "$SCRIPT_DIR/db-migrate.sh"
bash "$SCRIPT_DIR/rotate-jwt.sh"

npm install