#!/usr/bin/env bash
# Initialize demo_repo as its own git repo with main + feature branch for branch-verify demos.
set -euo pipefail
cd "$(dirname "$0")/../data/demo_repo"

if [[ -d .git ]]; then
  echo "demo_repo already a git repo"
  exit 0
fi

git init -b main
git add .
git commit -m "main: compliant checkout"

git checkout -b feature/bad-payments-import
cat >> apps/web/checkout.py <<'PY'

# DEMO: forbidden direct payments import
from packages.payments.client import charge_customer  # noqa: F401
PY
git add apps/web/checkout.py
git commit -m "feature: bad payments import for TrustLoop demo"

git checkout main
echo "Created main + feature/bad-payments-import in data/demo_repo"
