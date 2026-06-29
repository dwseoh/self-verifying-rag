import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiUrl =
    process.env.TRUSTLOOP_PUBLIC_API_URL ||
    process.env.TRUSTLOOP_BACKEND_URL ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") + "/backend" ||
    "http://localhost:8000";
  const repoPath = searchParams.get("repo_path") ?? "";
  const installDir = "${HOME}/.local/share/trustloop";
  const gitRepo = process.env.TRUSTLOOP_GIT_REPO?.trim() ?? "";

  const script = `#!/usr/bin/env bash
set -euo pipefail

TRUSTLOOP_API_URL="${apiUrl.replace(/"/g, '\\"')}"
TRUSTLOOP_REPO_PATH="${repoPath.replace(/"/g, '\\"')}"
TRUSTLOOP_INSTALL_DIR="${installDir}"
TRUSTLOOP_REPO="${gitRepo.replace(/"/g, '\\"')}"

echo "TrustLoop MCP installer"
echo "  API:  \$TRUSTLOOP_API_URL"
echo "  Dir:  \$TRUSTLOOP_INSTALL_DIR"

if [ -z "\$TRUSTLOOP_REPO" ]; then
  echo "Set TRUSTLOOP_GIT_REPO on the server (or export before running this script)."
  exit 1
fi

mkdir -p "\$TRUSTLOOP_INSTALL_DIR"
if [ ! -d "\$TRUSTLOOP_INSTALL_DIR/.git" ]; then
  git clone --depth 1 "\$TRUSTLOOP_REPO" "\$TRUSTLOOP_INSTALL_DIR" || {
    echo "Clone failed — set TRUSTLOOP_REPO to your fork if needed."
    exit 1
  }
else
  git -C "\$TRUSTLOOP_INSTALL_DIR" pull --ff-only || true
fi

PY="\${TRUSTLOOP_PYTHON:-python3}"
"\$PY" -m pip install -e "\$TRUSTLOOP_INSTALL_DIR[dev,mcp]" --quiet

CURSOR="\${HOME}/.cursor/mcp.json"
mkdir -p "\$(dirname "\$CURSOR")"
BLOCK='{
  "mcpServers": {
    "trustloop": {
      "command": "'"\$PY"'",
      "args": ["-m", "backend.mcp.server"],
      "cwd": "'"\$TRUSTLOOP_INSTALL_DIR"'",
      "env": {
        "TRUSTLOOP_API_URL": "'"\$TRUSTLOOP_API_URL"'",
        "TRUSTLOOP_REPO_PATH": "'"\$TRUSTLOOP_REPO_PATH"'"
      }
    }
  }
}'

if [ -f "\$CURSOR" ]; then
  echo "Merge trustloop into \$CURSOR manually if needed:"
  echo "\$BLOCK"
else
  echo "\$BLOCK" > "\$CURSOR"
  echo "Wrote \$CURSOR"
fi

echo "Done. Restart Cursor."
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": 'inline; filename="install-trustloop-mcp.sh"',
    },
  });
}
