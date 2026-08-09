set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)/_common.sh"

echo "==> Checking for high/critical severity vulnerabilities..."
if npm audit --audit-level=high; then
  echo "No high/critical vulnerabilities found."
else
  echo ""
  echo "Vulnerabilities found. Preview of 'npm audit fix':"
  npm audit fix --dry-run || true
  echo ""
  echo "Run 'npm audit fix' to apply the fix above, or 'npm audit' for full details."
  exit 1
fi