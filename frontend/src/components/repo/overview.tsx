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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Source files indexed", value: index.graph.cached_files },
          { label: "Dependency edges", value: index.graph.edges },
          { label: "Python files", value: index.graph.python_files },
          { label: "C/C++ files", value: index.graph.c_cpp_files },
        ].map((item) => (
          <article key={item.label} className="card-elevated rounded-lg bg-canvas p-5">
            <p className="font-mono text-xs uppercase text-mute">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
          </article>
        ))}
      </div>

      <article className="card-float rounded-lg bg-canvas p-6">
        <p className="font-mono text-xs uppercase text-mute">Rules corpus</p>
        <h3 className="mt-1 text-lg font-semibold">Auto-detected documentation</h3>
        <p className="mt-2 font-mono text-sm text-body">{index.corpus.path}</p>
        <p className="mt-2 text-sm text-body">
          {index.corpus.auto_discovered
            ? "Found inside this repo (docs/trustloop_corpus, engineering_corpus, etc.)"
            : "Using explicit corpus path"}
          {" · "}
          {index.corpus.section_count} rule sections loaded
        </p>
        {!index.is_git && (
          <p className="mt-3 text-sm text-warning">Not a git repo — branch/unstaged scopes unavailable.</p>
        )}
      </article>

      <article className="card-elevated rounded-lg bg-[#0a0a0a] p-6 font-mono text-xs leading-6 text-on-primary/90">
        <p className="text-on-primary/50">How indexing works</p>
        <p className="mt-2">
          Every run indexes the <strong className="text-on-primary">whole repo</strong> into a cached graph
          (imports + #includes). Verification scope only controls which <em>diff</em> is checked — cross-file
          dependencies always come from the full graph.
        </p>
      </article>
    </div>
  );
}
