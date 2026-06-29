import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repoPath = searchParams.get("repo_path") ?? "";
  const origin = new URL(request.url).origin;
  const apiUrl =
    process.env.TRUSTLOOP_PUBLIC_API_URL ||
    process.env.TRUSTLOOP_BACKEND_URL ||
    `${origin}/backend`;
  const installUrl = `${origin}/api/mcp/install.sh?repo_path=${encodeURIComponent(repoPath)}`;

  const cursorBlock = {
    mcpServers: {
      trustloop: {
        command: "bash",
        args: ["-c", `curl -fsSL '${installUrl}' | bash`],
        env: {
          TRUSTLOOP_API_URL: apiUrl,
          TRUSTLOOP_REPO_PATH: repoPath,
        },
      },
    },
  };

  return NextResponse.json({
    server_name: "trustloop",
    mode: "remote_api",
    install_url: installUrl,
    install_command: `curl -fsSL '${installUrl}' | bash`,
    api_url: apiUrl,
    default_repo_path: repoPath,
    tools: [
      { name: "verify_diff", description: "Run verification via TrustLoop API" },
      { name: "get_findings", description: "Findings from last verify_diff" },
      { name: "search_engineering_corpus", description: "Search rules corpus" },
    ],
    cursor_config_json: cursorBlock,
    cursor_config_path: "~/.cursor/mcp.json",
  });
}
