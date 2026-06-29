"use client";

import { useMemo, useState } from "react";
import type { ScopeMode, StoredRun } from "@/lib/types";
import { titleCase } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";

type SortKey = "newest" | "oldest" | "findings" | "latency";

function branchLabel(run: StoredRun): string {
  if (run.scopeMode === "branch") {
    const base = run.baseRef ?? run.result?.base_ref ?? "?";
    const head = run.headRef ?? run.result?.head_ref ?? "?";
    return `${base}…${head}`;
  }
  return titleCase(run.scopeMode);
}

function matchesSearch(run: StoredRun, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    run.id,
    run.result?.id ?? "",
    branchLabel(run),
    run.scopeMode,
    ...(run.result?.changed_paths ?? []),
    ...(run.result?.findings.map((f) => f.title) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export function RunHistory({
  runs,
  activeId,
  onSelect,
}: {
  runs: StoredRun[];
  activeId: string | null;
  onSelect: (run: StoredRun) => void;
}) {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [scope, setScope] = useState<ScopeMode | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const branches = useMemo(() => {
    const set = new Set(runs.map(branchLabel));
    return ["all", ...Array.from(set).sort()];
  }, [runs]);

  const filtered = useMemo(() => {
    let list = runs.filter(
      (r) =>
        matchesSearch(r, search) &&
        (branch === "all" || branchLabel(r) === branch) &&
        (scope === "all" || r.scopeMode === scope),
    );
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.startedAt.localeCompare(b.startedAt);
        case "findings":
          return (b.result?.findings.length ?? 0) - (a.result?.findings.length ?? 0);
        case "latency":
          return (b.result?.latency.total_ms ?? 0) - (a.result?.latency.total_ms ?? 0);
        default:
          return b.startedAt.localeCompare(a.startedAt);
      }
    });
    return list;
  }, [runs, search, branch, scope, sort]);

  return (
    <section className="card-elevated flex flex-col rounded-lg bg-canvas">
      <div className="border-b border-hairline p-4">
        <h3 className="font-mono text-xs uppercase tracking-wide text-mute">Run history</h3>
        <p className="mt-1 text-xs text-body">{filtered.length} of {runs.length} runs</p>
        <input
          type="search"
          placeholder="Search id, branch, files, findings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-3 h-9 w-full rounded-sm border border-hairline px-3 text-sm"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-8 rounded-sm border border-hairline px-2 text-xs"
          >
            {branches.map((b) => (
              <option key={b} value={b}>
                {b === "all" ? "All branches" : b}
              </option>
            ))}
          </select>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeMode | "all")}
            className="h-8 rounded-sm border border-hairline px-2 text-xs"
          >
            <option value="all">All scopes</option>
            <option value="branch">Branch</option>
            <option value="unstaged">Unstaged</option>
            <option value="staged">Staged</option>
            <option value="paths">Files</option>
          </select>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="mt-2 h-8 w-full rounded-sm border border-hairline px-2 text-xs"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="findings">Most findings</option>
          <option value="latency">Slowest first</option>
        </select>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-body">No runs match filters.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((r) => {
              const active = activeId === (r.result?.id ?? r.id);
              const result = r.result;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    disabled={!result}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                      active ? "border-ink bg-canvas-soft-2" : "border-transparent hover:bg-canvas-soft"
                    } ${!result ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-ink">{result?.id ?? r.id}</span>
                      {result ? (
                        <Badge
                          tone={
                            result.risk_level === "high"
                              ? "high"
                              : result.risk_level === "medium"
                                ? "medium"
                                : "low"
                          }
                        >
                          {result.risk_level}
                        </Badge>
                      ) : (
                        <Badge tone="medium">{r.status ?? "failed"}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-body">
                      {new Date(r.startedAt).toLocaleString()}
                      {result ? ` · ${result.latency.total_ms}ms` : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-mute">
                      {branchLabel(r)}
                      {result ? ` · ${result.findings.length} findings` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
