"use client";

import { useEffect, useState } from "react";
import { fetchRepoIndex } from "@/lib/api";
import type { RepoIndexResponse } from "@/lib/types";
import { loadSettings } from "@/lib/workspace";

export function RepoOverview({ repoPath }: { repoPath: string }) {
  const [index, setIndex] = useState<RepoIndexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = loadSettings().backendUrl;
    fetchRepoIndex(base, repoPath)
      .then(setIndex)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load index"));
  }, [repoPath]);

  if (error) {
    return (
      <div className="rounded-lg border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
        {error}
      </div>
    );
  }

  if (!index) {
    return <p className="text-sm text-body">Loading ingestion data…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Files in graph", value: index.graph.cached_files },
          { label: "Import edges", value: index.graph.edges },
          { label: "TS / JS files", value: index.graph.web_files ?? 0 },
          { label: "Python files", value: index.graph.python_files },
          { label: "C / C++ files", value: index.graph.c_cpp_files },
        ].map((item) => (
          <article key={item.label} className="card-elevated rounded-lg bg-canvas p-5">
            <p className="font-mono text-xs uppercase text-mute">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
          </article>
        ))}
      </div>

      <article className="card-float rounded-lg bg-canvas p-6">
        <p className="font-mono text-xs uppercase text-mute">Rules & context</p>
        <h3 className="mt-1 text-lg font-semibold">Knowledge loaded for verification</h3>
        <p className="mt-2 text-sm text-body">
          {index.corpus.summary ??
            (index.corpus.using_shared_default
              ? "Shared TrustLoop defaults"
              : `Rules from ${index.corpus.path}`)}
        </p>
        <p className="mt-2 text-sm text-body">
          {index.corpus.section_count} sections total
          {index.corpus.repo_knowledge_files
            ? ` · ${index.corpus.repo_knowledge_files} from this repo`
            : ""}
          {index.corpus.using_shared_default && (
            <span className="block mt-1 text-xs text-mute">
              Formal path: <code className="font-mono">{index.corpus.path}</code> — add{" "}
              <code className="font-mono">CLAUDE.md</code> or{" "}
              <code className="font-mono">docs/trustloop_corpus/</code> for project-specific rules.
            </span>
          )}
        </p>
        {index.corpus.knowledge_sources && index.corpus.knowledge_sources.length > 0 && (
          <ul className="mt-3 max-h-32 overflow-y-auto font-mono text-xs text-mute">
            {index.corpus.knowledge_sources.map((k) => (
              <li key={k.path}>{k.path}</li>
            ))}
          </ul>
        )}
        {!index.is_git && (
          <p className="mt-3 text-sm text-warning">Not a git repo — branch/unstaged scopes unavailable.</p>
        )}
      </article>

      {index.code_health && index.code_health.finding_count > 0 && (
        <article className="card-float rounded-lg bg-canvas p-6">
          <p className="font-mono text-xs uppercase text-mute">Code health</p>
          <h3 className="mt-1 text-lg font-semibold">
            {index.code_health.finding_count} signal(s) in repo
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-body">
            {index.code_health.findings.map((f) => (
              <li key={f.id} className="rounded-md border border-hairline px-3 py-2">
                <span className="font-medium text-ink">{f.title}</span>
                {f.recommended_fix && (
                  <p className="mt-1 text-xs text-mute">How to fix: {f.recommended_fix}</p>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}

      <article className="card-elevated rounded-lg bg-[#0a0a0a] p-6 font-mono text-xs leading-6 text-on-primary/90">
        <p className="text-on-primary/50">How indexing works</p>
        <p className="mt-2">
          Every run builds a cached graph from <strong className="text-on-primary">imports</strong> in
          Python, C/C++, TypeScript, and JavaScript. README / CLAUDE.md / docs are merged into the rules
          context. Scope only controls which <em>diff</em> gets verified.
        </p>
      </article>
    </div>
  );
}
