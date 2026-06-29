"use client";

import { useEffect, useState } from "react";
import { fetchRepoIndex } from "@/lib/api";
import type { RepoIndexResponse } from "@/lib/types";
import { loadSettings } from "@/lib/workspace";

export function RulesPanel({ repoPath }: { repoPath: string }) {
  const [index, setIndex] = useState<RepoIndexResponse | null>(null);

  useEffect(() => {
    fetchRepoIndex(loadSettings().backendUrl, repoPath).then(setIndex).catch(() => null);
  }, [repoPath]);

  if (!index) return <p className="text-sm text-body">Loading rules…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-body">
        Rules loaded from{" "}
        <code className="rounded bg-canvas-soft-2 px-1 font-mono text-xs">{index.corpus.path}</code>
        . Add markdown with{" "}
        <code className="font-mono text-xs">## CITATION_ID: Title</code> headers under{" "}
        <code className="font-mono text-xs">docs/trustloop_corpus/</code> in your repo — no manual path needed.
      </p>
      <div className="space-y-3">
        {index.corpus.documents.map((doc) => (
          <details key={doc.document} className="card-elevated rounded-lg bg-canvas p-4">
            <summary className="cursor-pointer font-medium text-ink">{doc.document}</summary>
            <ul className="mt-3 space-y-2 border-t border-hairline pt-3">
              {doc.sections.map((sec) => (
                <li key={sec.citation_id}>
                  <p className="font-mono text-xs text-link">{sec.citation_id}</p>
                  <p className="text-sm font-medium text-ink">{sec.section_title}</p>
                  <p className="mt-1 text-xs leading-5 text-body">{sec.text_preview}</p>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
