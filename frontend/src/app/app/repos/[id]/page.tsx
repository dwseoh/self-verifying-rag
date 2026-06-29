"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { getRepo } from "@/lib/workspace";
import { RepoOverview } from "@/components/repo/overview";
import { RunsPanel } from "@/components/repo/runs-panel";
import { RulesPanel } from "@/components/repo/rules";
import { McpSetupModal } from "@/components/repo/mcp-setup-modal";
import { Button } from "@/components/ui/button";

const tabs = [
  { id: "runs", label: "Runs" },
  { id: "overview", label: "Index" },
  { id: "rules", label: "Rules" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function RepoDashboardPage() {
  const params = useParams();
  const repoId = params.id as string;
  const repo = getRepo(repoId);
  const [tab, setTab] = useState<TabId>("runs");
  const [mcpOpen, setMcpOpen] = useState(false);

  if (!repo) {
    return (
      <div className="card-elevated rounded-lg bg-canvas p-8 text-center">
        <p className="text-body">Repository not found.</p>
        <Link href="/app/repositories" className="mt-4 inline-block text-link hover:underline">
          Back to repositories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app/repositories" className="text-sm text-link hover:underline">
            ← Repositories
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{repo.name}</h1>
          <p className="mt-1 font-mono text-sm text-body">{repo.path}</p>
          <p className="mt-1 text-xs text-mute">
            {repo.source === "github" ? repo.githubUrl : "Local path"} · branch {repo.defaultBranch}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMcpOpen(true)}>
            Connect MCP
          </Button>
        </div>
      </div>

      <McpSetupModal repoPath={repo.path} open={mcpOpen} onClose={() => setMcpOpen(false)} />

      <div className="flex gap-1 border-b border-hairline">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm ${
              tab === t.id ? "border-ink font-medium text-ink" : "border-transparent text-body"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "runs" && <RunsPanel repo={repo} />}
      {tab === "overview" && <RepoOverview repoPath={repo.path} />}
      {tab === "rules" && <RulesPanel repoPath={repo.path} />}
    </div>
  );
}
