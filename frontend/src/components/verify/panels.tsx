import type { VerificationRun } from "@/lib/types";
import { titleCase } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";

export function SummaryGrid({ run }: { run: VerificationRun }) {
  const items = [
    { label: "Risk", value: titleCase(run.risk_level) },
    { label: "Confidence", value: `${run.overall_confidence}%` },
    { label: "Latency", value: `${run.latency.total_ms}ms` },
    { label: "Agents", value: String(run.metadata.agents_run) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="card-elevated rounded-lg bg-canvas p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-mute">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{item.value}</p>
        </article>
      ))}
    </div>
  );
}

export function FindingsPanel({ run }: { run: VerificationRun }) {
  if (run.findings.length === 0) {
    return (
      <div className="card-elevated rounded-lg bg-canvas p-8 text-center">
        <p className="text-sm text-body">No open findings for this run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {run.findings.map((finding) => (
        <article key={finding.id} className="card-elevated rounded-lg bg-canvas p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-ink">{finding.title}</h3>
            <Badge
              tone={
                finding.severity === "high"
                  ? "high"
                  : finding.severity === "medium"
                    ? "medium"
                    : "low"
              }
            >
              {finding.severity}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-body">{finding.explanation}</p>
          <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs text-mute">
            <span>{finding.confidence}% confidence</span>
            <span>{finding.related_paths.join(", ")}</span>
            <span>{finding.detected_by.map(titleCase).join(", ")}</span>
          </div>
          {finding.recommended_fix && (
            <div className="mt-4 rounded-md border border-link/15 bg-link-bg-soft px-3 py-3">
              <p className="font-mono text-xs uppercase text-mute">How to fix</p>
              <p className="mt-1 text-sm leading-6 text-ink">{finding.recommended_fix}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function AgentTimeline({ run }: { run: VerificationRun }) {
  const max = Math.max(...run.agent_timeline.map((a) => a.latency_ms), 1);

  return (
    <div className="space-y-4">
      {run.agent_timeline.map((agent) => (
        <div key={agent.agent}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-ink">{titleCase(agent.agent)}</span>
            <span className="font-mono text-xs text-mute">
              {agent.latency_ms}ms · {agent.status}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas-soft-2">
            <div
              className="h-full rounded-full bg-ink transition-all"
              style={{ width: `${Math.max(8, (agent.latency_ms / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CitationsPanel({ run }: { run: VerificationRun }) {
  if (run.retrieved_chunks.length === 0) {
    return <p className="text-sm text-body">No corpus chunks retrieved.</p>;
  }

  return (
    <div className="space-y-3">
      {run.retrieved_chunks.map((chunk) => (
        <article key={chunk.citation_id} className="rounded-md border border-hairline bg-canvas-soft p-3">
          <p className="font-mono text-xs font-medium text-ink">
            {chunk.citation_id} · {chunk.document_title}
          </p>
          <p className="mt-2 text-sm leading-5 text-body">{chunk.text}</p>
        </article>
      ))}
    </div>
  );
}
