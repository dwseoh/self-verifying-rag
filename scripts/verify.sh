#!/usr/bin/env bash
set -euo pipefail
API="${TRUSTLOOP_API:-http://localhost:8000}"
curl -s -X POST "$API/api/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "data/demo_repo",
    "changed_paths": ["apps/web/checkout.py"],
    "trigger": "manual"
  }' | python3 -m json.tool
