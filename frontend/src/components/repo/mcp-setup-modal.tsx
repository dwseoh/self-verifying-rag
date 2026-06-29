"use client";

import { useEffect, useState } from "react";
import { fetchMcpConfig } from "@/lib/api";
import type { McpConfigResponse } from "@/lib/types";
import { loadSettings } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

export function McpSetupModal({
  repoPath,
  open,
  onClose,
}: {
  repoPath: string;
  open: boolean;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<McpConfigResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchMcpConfig(loadSettings().backendUrl, repoPath)
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load MCP config"));
  }, [open, repoPath]);

  if (!open) return null;

  const json = config ? JSON.stringify(config.cursor_config_json, null, 2) : "";

  async function copyConfig() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card-float max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-canvas p-6">
        <h2 className="text-lg font-semibold">Connect MCP</h2>
        <p className="mt-2 text-sm text-body">
          MCP lets Cursor (or Claude Code) call TrustLoop tools:{" "}
          <code className="font-mono text-xs">verify_diff</code>,{" "}
          <code className="font-mono text-xs">get_findings</code>,{" "}
          <code className="font-mono text-xs">search_engineering_corpus</code>.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-body">
          <li>
            Install MCP deps:{" "}
            <code className="rounded bg-canvas-soft px-1 font-mono text-xs">{config?.install ?? "pip install -e \".[mcp]\""}</code>
          </li>
          <li>
            Add to <code className="font-mono text-xs">{config?.cursor_config_path ?? "~/.cursor/mcp.json"}</code>{" "}
            (merge under <code className="font-mono text-xs">mcpServers</code>):
          </li>
        </ol>

        {error && (
          <p className="mt-3 text-sm text-error">{error}</p>
        )}

        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[#0a0a0a] p-3 font-mono text-xs leading-5 text-on-primary">
          {json || "Loading…"}
        </pre>

        <p className="mt-3 text-xs text-mute">
          Default repo for tools: <span className="font-mono">{repoPath}</span>. Restart Cursor after saving.
          Or run <code className="font-mono">{config?.run_script ?? "./scripts/run-mcp.sh"}</code> in a terminal for stdio mode.
        </p>

        <div className="mt-6 flex gap-2">
          <Button size="sm" onClick={copyConfig} disabled={!json}>
            {copied ? "Copied" : "Copy MCP JSON"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
