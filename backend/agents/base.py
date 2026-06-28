from __future__ import annotations

import uuid
from dataclasses import dataclass

from backend.llm import cerebras_client
from backend.models import AgentResult, CorpusChunk, Finding, Severity


@dataclass
class AgentContext:
    trigger: str
    diff_summary: str
    changed_paths: list[str]
    graph_excerpt: str
    corpus_chunks: list[CorpusChunk]


def _format_chunks(chunks: list[CorpusChunk]) -> str:
    return "\n\n".join(
        f"[{c.citation_id}] {c.section_title}\n{c.text[:800]}" for c in chunks
    )


async def run_verifier_agent(
    *,
    agent_name: str,
    system: str,
    ctx: AgentContext,
    focus: str,
) -> AgentResult:
    user = f"""Focus: {focus}

Trigger: {ctx.trigger}

Changed paths:
{chr(10).join(ctx.changed_paths)}

Diff:
{ctx.diff_summary[:6000]}

Graph excerpt:
{ctx.graph_excerpt}

Corpus chunks:
{_format_chunks(ctx.corpus_chunks)}

If no issue, return {{"findings": []}}.
"""
    try:
        data, latency_ms = await cerebras_client.complete_json(
            agent_name=agent_name,
            system=system,
            user=user,
        )
        findings: list[Finding] = []
        for raw in data.get("findings", []):
            findings.append(
                Finding(
                    id=f"f_{uuid.uuid4().hex[:8]}",
                    severity=Severity(raw.get("severity", "medium")),
                    confidence=75,
                    title=raw.get("title", "Finding"),
                    explanation=raw.get("explanation", ""),
                    citation_ids=raw.get("citation_ids", []),
                    related_paths=raw.get("related_paths", ctx.changed_paths),
                    recommended_fix=raw.get("recommended_fix"),
                    detected_by=[agent_name],
                )
            )
        return AgentResult(agent=agent_name, status="ok", latency_ms=latency_ms, findings=findings)
    except Exception as exc:  # noqa: BLE001 — degrade gracefully per agent
        return AgentResult(agent=agent_name, status="error", latency_ms=0, error=str(exc))
