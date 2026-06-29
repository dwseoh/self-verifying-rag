"use client";

import { useEffect, useState } from "react";
import {
  fetchHealth,
  fetchPreview,
  fetchRepoIndex,
  runVerification,
} from "@/lib/api";
import { fetchRuns, startRun as startRunApi } from "@/lib/saas-api";
import type {
  PipelineStep,
  Repository,
  ScopeMode,
  StoredRun,
  VerificationRun,
} from "@/lib/types";
import { loadSettings } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RunHistory } from "@/components/repo/run-history";
import {
  AgentTimeline,
  CitationsPanel,
  FindingsPanel,
  SummaryGrid,
} from "@/components/verify/panels";
import { isNorthstarDemoRepo } from "@/lib/demo";

const INITIAL_STEPS: PipelineStep[] = [
  { id: "index", label: "Index repository", status: "pending" },
  { id: "scope", label: "Resolve change scope", status: "pending" },
  { id: "rules", label: "Load rules corpus", status: "pending" },
  { id: "agents", label: "Run parallel verifiers", status: "pending" },
  { id: "compose", label: "Compose findings", status: "pending" },
];

const DEMO_CHECKOUT_PATH = "apps/web/checkout.py";

export function RunsPanel({
  repo,
  workspacePath,
}: {
  repo: Repository;
  workspacePath?: string;
}) {
  const settings = loadSettings();
  const repoPath = workspacePath || repo.path;
  const isDemoRepo = isNorthstarDemoRepo(repoPath);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [activeRun, setActiveRun] = useState<VerificationRun | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [demoChanging, setDemoChanging] = useState<"clean" | "violation" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<"clean" | "violation" | "unknown">("unknown");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("branch");
  const [baseRef, setBaseRef] = useState(repo.defaultBranch);
  const [headRef, setHeadRef] = useState("HEAD");
  const [paths, setPaths] = useState("");
  const [snapshotPrefix, setSnapshotPrefix] = useState("src/");
  const [scopePreview, setScopePreview] = useState<{
    fileCount: number | null;
    warning: string | null;
    loading: boolean;
  }>({ fileCount: null, warning: null, loading: false });

  useEffect(() => {
    fetchRuns(repo.id).then((loaded) => {
      setRuns(loaded);
      if (loaded[0]?.result) setActiveRun(loaded[0].result);
    });
  }, [repo.id]);

  useEffect(() => {
    if (scopeMode === "snapshot") {
      setHeadRef((current) => (current === "HEAD" ? repo.defaultBranch || "main" : current));
    }
  }, [scopeMode, repo.defaultBranch]);

  useEffect(() => {
    if (scopeMode === "paths" && !paths.trim()) {
      setScopePreview({ fileCount: null, warning: null, loading: false });
      return;
    }
    const backend = settings.backendUrl;
    const t = setTimeout(() => {
      setScopePreview((p) => ({ ...p, loading: true }));
      fetchPreview(backend, {
        repo_path: repoPath,
        base_ref: baseRef,
        head_ref: headRef,
        scope_mode: scopeMode,
        snapshot_prefix: scopeMode === "snapshot" && snapshotPrefix.trim() ? snapshotPrefix.trim() : undefined,
        changed_paths:
          scopeMode === "paths" && paths.trim()
            ? paths.split(",").map((p) => p.trim()).filter(Boolean)
            : undefined,
      })
        .then((preview) => {
          const changed = (preview.changed_paths as string[]) ?? [];
          setScopePreview({
            fileCount: changed.length,
            warning: (preview.warning as string) ?? null,
            loading: false,
          });
        })
        .catch(() => setScopePreview({ fileCount: null, warning: null, loading: false }));
    }, 400);
    return () => clearTimeout(t);
  }, [scopeMode, baseRef, headRef, paths, snapshotPrefix, repoPath, settings.backendUrl]);

  function patchStep(id: PipelineStep["id"], patch: Partial<PipelineStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function setCheckoutDemoState(mode: "clean" | "violation") {
    setDemoChanging(mode);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/demo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDemoState(mode);
      setPaths(DEMO_CHECKOUT_PATH);
      setScopeMode("paths");
      setWarning(
        mode === "clean"
          ? "checkout.py reset to the clean gateway path. Run Verify to show no high-severity findings."
          : "Boundary violation seeded in checkout.py. Run Verify to show the high-severity finding.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update checkout.py");
    } finally {
      setDemoChanging(null);
    }
  }

  async function startRun(useFixture?: "clean" | "violation") {
    setRunning(true);
    setError(null);
    setWarning(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" as const })));

    const baseUrl = settings.backendUrl;
    const requestedChangedPaths =
      scopeMode === "paths" && paths.trim()
        ? paths.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined;
    let resolvedChangedPaths = requestedChangedPaths;

    const body = {
      repo_path: repoPath,
      base_ref: baseRef,
      head_ref: headRef,
      scope_mode: scopeMode,
      snapshot_prefix: scopeMode === "snapshot" && snapshotPrefix.trim() ? snapshotPrefix.trim() : undefined,
      changed_paths: requestedChangedPaths,
    };

    try {
      if (!useFixture) {
        const health = await fetchHealth(baseUrl);
        if (health.mock_mode) {
          setWarning(
            "Backend is in mock mode because CEREBRAS_API_KEY is missing. Verify still runs against the live pipeline shape.",
          );
        }
      }

      patchStep("index", { status: "running" });
      const t0 = performance.now();
      const index = await fetchRepoIndex(baseUrl, repoPath);
      patchStep("index", {
        status: "done",
        ms: Math.round(performance.now() - t0),
        detail: `${index.graph.cached_files} files · ${index.graph.edges} edges`,
      });

      patchStep("scope", { status: "running" });
      const t1 = performance.now();
      const preview = await fetchPreview(baseUrl, body);
      const changed = (preview.changed_paths as string[]) ?? [];
      if (!resolvedChangedPaths && changed.length > 0) {
        resolvedChangedPaths = changed;
      }
      patchStep("scope", {
        status: "done",
        ms: Math.round(performance.now() - t1),
        detail: `${changed.length} file(s) in scope`,
      });
      if (preview.warning) {
        setWarning(String(preview.warning));
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

      let stored: StoredRun;
      try {
        stored = await startRunApi({
          repositoryId: repo.id,
          scopeMode,
          baseRef,
          headRef,
          changedPaths: resolvedChangedPaths,
          snapshotPrefix: scopeMode === "snapshot" ? snapshotPrefix.trim() : undefined,
          fixture: useFixture,
        });
      } catch {
        const result = await runVerification(
          baseUrl,
          { ...body, changed_paths: resolvedChangedPaths },
          useFixture ? { fixture: useFixture } : undefined,
        );
        stored = {
          id: result.id,
          repoId: repo.id,
          scopeMode,
          baseRef,
          headRef,
          startedAt: new Date().toISOString(),
          result,
        };
      }

      const result = stored.result!;
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

      setRuns((prev) => [stored, ...prev]);
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
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div className="space-y-8 min-w-0">
      <section className="card-float rounded-lg bg-canvas p-6">
        <p className="font-mono text-xs uppercase text-mute">Start a run</p>
        <h2 className="mt-1 text-lg font-semibold">Verify changes</h2>
        <p className="mt-2 text-sm text-body">
          A <strong>run</strong> indexes the whole repo (cached), then verifies your selected change scope
          against rules + dependency graph. Same pipeline as CI — not a separate “verify” product.
        </p>
        <div className="mt-4 rounded-lg border border-hairline bg-canvas-soft px-4 py-3 text-sm">
          <p className="font-medium text-ink">Scope preview</p>
          <p className="mt-1 text-xs text-body">
            Dry-run of what the backend will verify — calls{" "}
            <code className="font-mono">/api/verify/preview</code> (no LLM). Updates when you change scope.
          </p>
          <dl className="mt-3 space-y-1 font-mono text-xs text-body">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-mute">mode</dt>
              <dd>
                {scopeMode === "branch" && `branch diff · ${baseRef}…${headRef}`}
                {scopeMode === "snapshot" && `snapshot · @${headRef}${snapshotPrefix.trim() ? ` · ${snapshotPrefix.trim()}` : ""}`}
                {scopeMode === "unstaged" && "unstaged working tree"}
                {scopeMode === "staged" && "staged index"}
                {scopeMode === "paths" && (paths.trim() ? `paths · ${paths}` : "paths · (none yet)")}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-mute">repo</dt>
              <dd className="break-all">{repoPath}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-mute">files</dt>
              <dd>
                {scopePreview.loading
                  ? "resolving…"
                  : scopePreview.fileCount != null
                    ? `${scopePreview.fileCount} in scope`
                    : "—"}
              </dd>
            </div>
          </dl>
          {scopePreview.warning && (
            <p className="mt-2 text-xs text-warning">{scopePreview.warning}</p>
          )}
        </div>

        {isDemoRepo && (
        <div className="mt-4 rounded-lg border border-hairline bg-canvas px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">Demo checkout state</p>
              <p className="mt-1 text-xs text-body">
                Reset clean, seed the forbidden import, then verify the same file.
              </p>
            </div>
            <Badge tone={demoState === "violation" ? "high" : demoState === "clean" ? "low" : "info"}>
              {demoState}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCheckoutDemoState("clean")}
              disabled={running || demoChanging !== null}
            >
              {demoChanging === "clean" ? "Resetting..." : "Reset clean"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCheckoutDemoState("violation")}
              disabled={running || demoChanging !== null}
            >
              {demoChanging === "violation" ? "Seeding..." : "Seed violation"}
            </Button>
          </div>
        </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-body">Change scope</span>
            <select
              className="mt-1 h-10 w-full rounded-sm border border-hairline px-3"
              value={scopeMode}
              onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
            >
              <option value="branch">Branch diff (base…head)</option>
              <option value="snapshot">Snapshot (review ref as-is)</option>
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
          {scopeMode === "snapshot" && (
            <>
              <label className="block text-sm">
                <span className="text-body">Git ref to review</span>
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                  value={headRef}
                  onChange={(e) => setHeadRef(e.target.value)}
                  placeholder="main"
                />
              </label>
              <label className="block text-sm">
                <span className="text-body">Path prefix (optional)</span>
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                  value={snapshotPrefix}
                  onChange={(e) => setSnapshotPrefix(e.target.value)}
                  placeholder="src/"
                />
                <span className="mt-1 block text-xs text-mute">
                  Only files under this folder (e.g. <code className="font-mono">src/</code>,{" "}
                  <code className="font-mono">app/</code>). Up to 80 code files prioritized — not all 796 at once.
                </span>
              </label>
            </>
          )}
          {scopeMode === "paths" && (
            <label className="block text-sm md:col-span-2">
              <span className="text-body">Files (comma-separated)</span>
              <input
                className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                placeholder="src/app/page.tsx, lib/api.ts"
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startRun()} disabled={running}>
            {running ? "Running…" : "Start verification"}
          </Button>
          {isDemoRepo && (
            <>
              <Button variant="secondary" size="sm" onClick={() => startRun("violation")} disabled={running}>
                Demo violation fixture
              </Button>
              <Button variant="secondary" size="sm" onClick={() => startRun("clean")} disabled={running}>
                Demo clean fixture
              </Button>
            </>
          )}
        </div>

        {warning && (
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink">
            {warning}
          </div>
        )}

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

      {!activeRun && !running && runs.length === 0 && (
        <div className="card-elevated rounded-lg bg-canvas p-12 text-center">
          <p className="text-sm font-medium text-ink">No verification run selected.</p>
          <p className="mt-2 text-sm text-body">
            {isDemoRepo
              ? "Use Reset clean, Start verification, then Seed violation and verify again for the judge demo path."
              : "Choose a change scope (branch diff is default) and start a verification run."}
          </p>
        </div>
      )}
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <RunHistory
          runs={runs}
          activeId={activeRun?.id ?? null}
          onSelect={(r) => r.result && setActiveRun(r.result)}
        />
      </aside>
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
