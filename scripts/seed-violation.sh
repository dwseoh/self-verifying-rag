#!/usr/bin/env bash
# Add violation import to checkout.py for demo (reset with git checkout or manual edit)
set -euo pipefail
FILE="data/demo_repo/apps/web/checkout.py"
if grep -q "packages.payments.client" "$FILE"; then
  echo "Violation already present in $FILE"
  exit 0
fi
cat >> "$FILE" <<'PY'

# DEMO VIOLATION — remove for clean verify
from packages.payments.client import charge_customer  # noqa: F401
PY
echo "Added boundary violation to $FILE"
