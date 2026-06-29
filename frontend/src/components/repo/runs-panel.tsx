"use client";

import { useState } from "react";
import {
  fetchHealth,
  fetchPreview,
  fetchRepoIndex,
  runVerification,
} from "@/lib/api";
import type {
  PipelineStep,
  Repository,
  ScopeMode,
  StoredRun,
  VerificationRun,
} from "@/lib/types";
import { loadRuns, loadSettings, saveRun, titleCase } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AgentTimeline,
  CitationsPanel,
  FindingsPanel,
  SummaryGrid,
} from "@/components/verify/panels";

const INITIAL_STEPS: PipelineStep[] = [
  { id: "index", label: "Index repository", status: "pending" },
  { id: "scope", label: "Resolve change scope", status: "pending" },
  { id: "rules", label: "Load rules corpus", status: "pending" },
  { id: "agents", label: "Run parallel verifiers", status: "pending" },
  { id: "compose", label: "Compose findings", status: "pending" },
];

export function RunsPanel({ repo }: { repo: Repository }) {
  const settings = loadSettings();
  const [runs, setRuns] = useState<StoredRun[]>(() => loadRuns(repo.id));
  const [activeRun, setActiveRun] = useState<VerificationRun | null>(runs[0]?.result ?? null);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("branch");
  const [baseRef, setBaseRef] = useState(repo.defaultBranch);
  const [headRef, setHeadRef] = useState("HEAD");
  const [paths, setPaths] = useState("");

  function patchStep(id: PipelineStep["id"], patch: Partial<PipelineStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function startRun(useFixture?: "clean" | "violation") {
    setRunning(true);
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" as const })));

    const baseUrl = settings.backendUrl;
    const changed_paths =
      scopeMode === "paths" && paths.trim()
        ? paths.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined;

    const body = {
      repo_path: repo.path,
      base_ref: baseRef,
      head_ref: headRef,
      scope_mode: scopeMode,
      changed_paths,
    };

    try {
      if (!useFixture) {
        const health = await fetchHealth(baseUrl);
        if (health.mock_mode) {
          throw new Error(
            "No Cerebras API key on the backend. Add CEREBRAS_API_KEY to backend .env, or use Demo run.",
          );
        }
      }

      patchStep("index", { status: "running" });
      const t0 = performance.now();
      const index = await fetchRepoIndex(baseUrl, repo.path);
      patchStep("index", {
        status: "done",
        ms: Math.round(performance.now() - t0),
        detail: `${index.graph.cached_files} files · ${index.graph.edges} edges`,
      });

      patchStep("scope", { status: "running" });
      const t1 = performance.now();
      const preview = await fetchPreview(baseUrl, body);
      const changed = (preview.changed_paths as string[]) ?? [];
      patchStep("scope", {
        status: "done",
        ms: Math.round(performance.now() - t1),
        detail: `${changed.length} file(s) in scope`,
      });
      if (preview.warning) {
        setError(String(preview.warning));
      }

      patchStep("rules", { status: "running" });
      patchStep("rules", {
        status: "done",
        detail: `${index.corpus.section_count} sections from ${index.corpus.path.split("/").slice(-2).join("/")}`,
      });

      if (useFixture) {
        patchStep("agents", { status: "skipped", detail: "Fixture mode" });
        patchStep("compose", { status: "running" });
      } else {
        patchStep("agents", { status: "running" });
      }

      const result = await runVerification(baseUrl, body, useFixture ? { fixture: useFixture } : undefined);
      patchStep("agents", {
        status: "done",
        ms: result.latency.parallel_verification_ms,
        detail: `${result.metadata.agents_run} agents`,
      });

      patchStep("compose", { status: "running" });
      patchStep("compose", {
        status: "done",
        ms: result.latency.composition_ms,
        detail: `${result.findings.length} findings`,
      });

      const stored: StoredRun = {
        id: result.id,
        repoId: repo.id,
        scopeMode,
        startedAt: new Date().toISOString(),
        result,
      };
      saveRun(stored);
      setRuns([stored, ...runs]);
      setActiveRun(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Run failed";
      setError(msg);
      setSteps((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.status === "running" || s.status === "pending");
        if (idx >= 0) next[idx] = { ...next[idx], status: "error", detail: msg };
        return next;
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card-float rounded-lg bg-canvas p-6">
        <p className="font-mono text-xs uppercase text-mute">Start a run</p>
        <h2 className="mt-1 text-lg font-semibold">Verify changes</h2>
        <p className="mt-2 text-sm text-body">
          A <strong>run</strong> indexes the whole repo (cached), then verifies your selected change scope
          against rules + dependency graph. Same pipeline as CI — not a separate “verify” product.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-body">Change scope</span>
            <select
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3"
              value={scopeMode}
              onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
            >
              <option value="branch">Branch diff (base…head)</option>
              <option value="unstaged">Unstaged working tree</option>
              <option value="staged">Staged changes</option>
              <option value="paths">Specific files</option>
            </select>
          </label>
          {scopeMode === "branch" && (
            <>
              <label className="block text-sm">
                <span className="text-body">Base ref</span>
                <input className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm" value={baseRef} onChange={(e) => setBaseRef(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-body">Head ref</span>
                <input className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm" value={headRef} onChange={(e) => setHeadRef(e.target.value)} />
              </label>
            </>
          )}
          {scopeMode === "paths" && (
            <label className="block text-sm md:col-span-2">
              <span className="text-body">Files (comma-separated)</span>
              <input
                className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                placeholder="apps/web/checkout.py"
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startRun()} disabled={running}>
            {running ? "Running…" : "Start run"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => startRun("violation")} disabled={running}>
            Demo (fixture)
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <ol className="mt-8 space-y-3">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3 text-sm">
              <StepIcon status={step.status} />
              <div>
                <p className="font-medium text-ink">{step.label}</p>
                {step.detail && <p className="text-body">{step.detail}</p>}
                {step.ms != null && <p className="font-mono text-xs text-mute">{step.ms}ms</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {runs.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase text-mute">Run history</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRun(r.result)}
                className={`rounded-sm border px-3 py-2 text-left text-sm ${
                  activeRun?.id === r.id ? "border-ink bg-canvas-soft-2" : "border-hairline bg-canvas"
                }`}
              >
                <span className="font-mono text-xs">{r.id}</span>
                <span className="ml-2 text-body">{titleCase(r.result.risk_level)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeRun && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{activeRun.id}</Badge>
            {activeRun.warnings?.map((w) => (
              <Badge key={w} tone="medium">
                {w.length > 60 ? `${w.slice(0, 60)}…` : w}
              </Badge>
            ))}
          </div>
          <SummaryGrid run={activeRun} />
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="card-float rounded-lg bg-canvas p-6">
              <h3 className="text-lg font-semibold">Findings</h3>
              <div className="mt-4">
                <FindingsPanel run={activeRun} />
              </div>
            </section>
            <aside className="space-y-6">
              <section className="card-elevated rounded-lg bg-canvas p-6">
                <h3 className="text-lg font-semibold">Agents</h3>
                <div className="mt-4">
                  <AgentTimeline run={activeRun} />
                </div>
              </section>
              <section className="card-elevated rounded-lg bg-canvas p-6">
                <h3 className="text-lg font-semibold">Citations</h3>
                <div className="mt-4">
                  <CitationsPanel run={activeRun} />
                </div>
              </section>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  const colors = {
    pending: "bg-canvas-soft-2 text-mute",
    running: "bg-link-bg-soft text-link animate-pulse",
    done: "bg-cyan/20 text-ink",
    error: "bg-error-soft text-error",
    skipped: "bg-canvas-soft text-mute",
  };
  const labels = { pending: "○", running: "…", done: "✓", error: "!", skipped: "−" };
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
