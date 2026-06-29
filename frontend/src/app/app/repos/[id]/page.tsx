"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Repository } from "@/lib/types";
import { fetchRepository } from "@/lib/saas-api";
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
  const [repo, setRepo] = useState<Repository | null>(null);
  const [tab, setTab] = useState<TabId>("runs");
  const [mcpOpen, setMcpOpen] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string>("");

  useEffect(() => {
    fetchRepository(repoId).then((r) => {
      setRepo(r);
      if (r) {
        fetch(`/api/repos/${repoId}/path`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => setWorkspacePath(data?.path ?? r.path))
          .catch(() => setWorkspacePath(r.path));
      }
    });
  }, [repoId]);

  if (!repo) {
    return (
      <div className="card-elevated rounded-lg bg-canvas p-8 text-center">
        <p className="text-body">Loading repository…</p>
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
            {repo.source === "github" ? repo.githubUrl ?? "GitHub" : "Local git"} · branch{" "}
            {repo.defaultBranch}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMcpOpen(true)}>
            Connect MCP
          </Button>
        </div>
      </div>

      <McpSetupModal
        repoPath={workspacePath || repo.path}
        open={mcpOpen}
        onClose={() => setMcpOpen(false)}
      />

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

      {tab === "runs" && <RunsPanel repo={repo} workspacePath={workspacePath} />}
      {tab === "overview" && <RepoOverview repoPath={workspacePath || repo.path} />}
      {tab === "rules" && <RulesPanel repoPath={workspacePath || repo.path} />}
    </div>
  );
}
