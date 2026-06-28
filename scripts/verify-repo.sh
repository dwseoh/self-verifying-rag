#!/usr/bin/env bash
# Verify any local repo path (absolute or relative to trustloop root).
set -euo pipefail
REPO="${1:?Usage: ./scripts/verify-repo.sh <path-to-repo> [file1.py file2.py ...]}"
shift || true
API="${TRUSTLOOP_API:-http://localhost:8000}"

PATHS_JSON="[]"
if [[ $# -gt 0 ]]; then
  PATHS_JSON=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "$@")
fi

python3 <<PY
import json, urllib.request
repo = """$REPO"""
paths = json.loads("""$PATHS_JSON""")
body = {"repo_path": repo, "trigger": "manual"}
if paths:
    body["changed_paths"] = paths
req = urllib.request.Request(
    "$API/api/verify",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    print(json.dumps(json.load(resp), indent=2))
PY
