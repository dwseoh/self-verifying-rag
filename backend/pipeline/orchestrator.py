import asyncio
import time
import uuid
from pathlib import Path

from backend.agents import base, run_architecture_boundary, run_incident_pattern, run_risk
from backend.config import settings
from backend.indexer import graph as graph_indexer
from backend.models import (
    AgentResult,
    AgentTimelineEntry,
    LatencyBreakdown,
    RunMetadata,
    VerificationRun,
    VerifyRequest,
)
from backend.pipeline import composer
from backend.retrieval.retriever import load_corpus, retrieve
from backend.scoring import confidence as confidence_scoring


async def run_verification(req: VerifyRequest) -> VerificationRun:
    t0 = time.perf_counter()
    repo = Path(req.repo_path) if req.repo_path else settings.trustloop_repo_path
    changed = req.changed_paths or ["apps/web/checkout.py"]

    t_index = time.perf_counter()
    g = graph_indexer.build_graph(repo)
    scope = graph_indexer.affected_paths(changed, g)
    diff = req.diff_summary or graph_indexer.diff_summary_for_paths(repo, changed)
    excerpt = graph_indexer.graph_excerpt(g, scope)
    indexing_ms = int((time.perf_counter() - t_index) * 1000)

    t_ret = time.perf_counter()
    corpus = load_corpus()
    query = f"{diff}\n{' '.join(changed)}"
    chunks = retrieve(query, corpus, top_k=5)
    retrieval_ms = int((time.perf_counter() - t_ret) * 1000)

    ctx = base.AgentContext(
        trigger=req.trigger.value,
        diff_summary=diff,
        changed_paths=changed,
        graph_excerpt=excerpt,
        corpus_chunks=chunks,
    )

    t_par = time.perf_counter()
    raw_results = await asyncio.gather(
        run_architecture_boundary(ctx),
        run_incident_pattern(ctx),
        run_risk(ctx),
        return_exceptions=True,
    )
    parallel_ms = int((time.perf_counter() - t_par) * 1000)

    agent_results: list[AgentResult] = []
    timeline: list[AgentTimelineEntry] = []
    verification_incomplete = False

    for r in raw_results:
        if isinstance(r, Exception):
            verification_incomplete = True
            timeline.append(AgentTimelineEntry(agent="unknown", status="error", latency_ms=0, error=str(r)))
            continue
        agent_results.append(r)
        timeline.append(
            AgentTimelineEntry(
                agent=r.agent,
                status=r.status,
                latency_ms=r.latency_ms,
                error=r.error,
            )
        )
        if r.status == "error":
            verification_incomplete = True

    t_comp = time.perf_counter()
    findings = composer.compose_findings(agent_results, chunks)
    findings = confidence_scoring.score_findings(findings, verification_incomplete)
    composition_ms = int((time.perf_counter() - t_comp) * 1000)

    risk_level = "low"
    if any(f.severity.value == "high" for f in findings):
        risk_level = "high"
    elif findings:
        risk_level = "medium"

    total_ms = int((time.perf_counter() - t0) * 1000)

    return VerificationRun(
        id=f"run_{uuid.uuid4().hex[:10]}",
        trigger=req.trigger,
        repo_path=str(repo),
        base_ref=req.base_ref,
        head_ref=req.head_ref,
        changed_paths=changed,
        findings=findings,
        risk_level=risk_level,  # type: ignore[arg-type]
        overall_confidence=confidence_scoring.overall_confidence(findings, verification_incomplete),
        verification_incomplete=verification_incomplete,
        agent_timeline=timeline,
        retrieved_chunks=chunks,
        latency=LatencyBreakdown(
            indexing_ms=indexing_ms,
            retrieval_ms=retrieval_ms,
            parallel_verification_ms=parallel_ms,
            composition_ms=composition_ms,
            total_ms=total_ms,
        ),
        metadata=RunMetadata(
            files_checked=len(scope),
            citations_consulted=len(chunks),
            agents_run=len(timeline),
        ),
    )
