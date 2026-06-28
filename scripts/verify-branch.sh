#!/usr/bin/env bash
# Compare git branches inside a repo (uses git diff — incremental scope).
set -euo pipefail
REPO="${1:?Usage: ./scripts/verify-branch.sh <repo-path> [base] [head]}"
BASE="${2:-main}"
HEAD="${3:-HEAD}"
API="${TRUSTLOOP_API:-http://localhost:8000}"

curl -s -X POST "$API/api/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"repo_path\": \"$REPO\",
    \"base_ref\": \"$BASE\",
    \"head_ref\": \"$HEAD\",
    \"trigger\": \"pr\"
  }" | python3 -m json.tool
