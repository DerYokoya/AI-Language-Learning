#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)/_common.sh"

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE found"; exit 1; }
grep -q '^JWT_SECRET=' "$ENV_FILE" || { echo "JWT_SECRET line not found in $ENV_FILE"; exit 1; }

new_secret=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$new_secret/" "$ENV_FILE" && rm "$ENV_FILE.bak"

echo "JWT_SECRET rotated. Restart your app to apply it."
echo "Note: if JWT_REFRESH_SECRET is set separately in $ENV_FILE, rotate that too."