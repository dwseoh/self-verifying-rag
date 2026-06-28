#!/usr/bin/env bash
# Show context assembly without calling Cerebras (free debug).
set -euo pipefail
REPO="${1:-data/demo_repo}"
API="${TRUSTLOOP_API:-http://localhost:8000}"

curl -s -X POST "$API/api/verify/preview" \
  -H "Content-Type: application/json" \
  -d "{
    \"repo_path\": \"$REPO\",
    \"changed_paths\": [\"apps/web/checkout.py\"],
    \"trigger\": \"manual\"
  }" | python3 -m json.tool
