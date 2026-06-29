"use client";

import { useEffect, useState } from "react";
import { addRule, fetchRepoIndex } from "@/lib/api";
import type { RepoIndexResponse } from "@/lib/types";
import { loadSettings } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

export function RulesPanel({ repoPath }: { repoPath: string }) {
  const [index, setIndex] = useState<RepoIndexResponse | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [citationId, setCitationId] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchRepoIndex(loadSettings().backendUrl, repoPath).then(setIndex).catch(() => null);
  }, [repoPath]);

  async function submitRule() {
    if (!citationId.trim() || !sectionTitle.trim() || !body.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await addRule(loadSettings().backendUrl, {
        repo_path: repoPath,
        citation_id: citationId.trim().toUpperCase().replace(/\s+/g, "_"),
        section_title: sectionTitle.trim(),
        body: body.trim(),
      });
      setMessage({ type: "ok", text: `Saved to ${res.path}` });
      setCitationId("");
      setSectionTitle("");
      setBody("");
      setShowAdd(false);
      fetchRepoIndex(loadSettings().backendUrl, repoPath).then(setIndex).catch(() => null);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to save rule",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!index) return <p className="text-sm text-body">Loading rules…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-body">
          Rules from{" "}
          <code className="rounded bg-canvas-soft-2 px-1 font-mono text-xs">{index.corpus.path}</code>
          {" · "}
          {index.corpus.section_count} sections
        </p>
          {index.corpus.using_global_fallback && !index.corpus.repo_knowledge_files && (
            <p className="mt-2 rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-xs text-body">
              No rules folder in this repo — using TrustLoop&apos;s shared default corpus. Add{" "}
              <code className="font-mono">CLAUDE.md</code>,{" "}
              <code className="font-mono">docs/trustloop_corpus/</code>, or use <strong>Add rule</strong>.
            </p>
          )}
          {(index.corpus.repo_knowledge_files ?? 0) > 0 && (
            <p className="mt-2 text-xs text-body">
              Indexed {index.corpus.repo_knowledge_files} repo knowledge file(s) — CLAUDE.md, README, docs,{" "}
              .cursor/rules, postmortems, etc.
            </p>
          )}
        <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add rule"}
        </Button>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border border-link/20 bg-link-bg-soft text-link-deep"
              : "border border-error/20 bg-error-soft text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {showAdd && (
        <section className="card-float space-y-3 rounded-lg bg-canvas p-5">
          <h3 className="font-semibold text-ink">New rule section</h3>
          <p className="text-xs text-body">
            Writes markdown to{" "}
            <code className="font-mono">docs/trustloop_corpus/custom_rules.md</code> (created if missing).
            Use format <code className="font-mono">TEAM_STYLE_001</code> for citation IDs.
          </p>
          <input
            placeholder="Citation ID (e.g. OBC_STYLE_008)"
            value={citationId}
            onChange={(e) => setCitationId(e.target.value)}
            className="h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
          />
          <input
            placeholder="Section title"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            className="h-10 w-full rounded-sm border border-hairline px-3 text-sm"
          />
          <textarea
            placeholder="Rule body (markdown)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-sm border border-hairline px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={submitRule} disabled={saving}>
            {saving ? "Saving…" : "Save rule"}
          </Button>
        </section>
      )}

      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
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
