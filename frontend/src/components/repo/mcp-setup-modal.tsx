"use client";

import { useEffect, useState } from "react";
import { fetchMcpConfigSaas } from "@/lib/saas-api";
import type { McpConfigResponse } from "@/lib/types";
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
    fetchMcpConfigSaas(repoPath)
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

  async function copyInstall() {
    if (!config?.install_command) return;
    await navigator.clipboard.writeText(config.install_command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card-float max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-canvas p-6">
        <h2 className="text-lg font-semibold">Connect MCP</h2>
        <p className="mt-2 text-sm text-body">
          Installs TrustLoop locally via curl — no hardcoded dev paths. Tools call your deployed API.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-body">
          <li>
            Run install script:{" "}
            <code className="block mt-1 rounded bg-canvas-soft px-2 py-1 font-mono text-xs break-all">
              {config?.install_command ?? "Loading…"}
            </code>
          </li>
          <li>
            Or merge into{" "}
            <code className="font-mono text-xs">{config?.cursor_config_path ?? "~/.cursor/mcp.json"}</code>
          </li>
        </ol>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[#0a0a0a] p-3 font-mono text-xs leading-5 text-on-primary">
          {json || "Loading…"}
        </pre>

        <p className="mt-3 text-xs text-mute">
          API: <span className="font-mono">{config?.api_url ?? "—"}</span> · Repo:{" "}
          <span className="font-mono">{repoPath || "set per tool call"}</span>. Restart Cursor after install.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={copyInstall} disabled={!config?.install_command}>
            {copied ? "Copied" : "Copy install command"}
          </Button>
          <Button size="sm" variant="secondary" onClick={copyConfig} disabled={!json}>
            Copy MCP JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
