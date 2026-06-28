import asyncio
import time
import uuid

from backend.agents import (
    base,
    run_architecture_boundary,
    run_convention,
    run_doc_drift,
    run_incident_pattern,
    run_risk,
)
from backend.config import settings
from backend.indexer import graph as graph_indexer
from backend.indexer.graph_cache import build_graph_cached
from backend.indexer.scope import resolve_scope
from backend.models import (
    AgentResult,
    AgentTimelineEntry,
    LatencyBreakdown,
    RunMetadata,
    VerificationRun,
    VerifyRequest,
)
from backend.pipeline import composer
from backend.retrieval.retriever import corpus_relevance, corpus_weak, load_corpus, retrieve
from backend.scoring import confidence as confidence_scoring

# All micro-verifiers fan out in parallel (MVP: 3, Sprint 3: 5)
AGENT_RUNNERS = [
    run_architecture_boundary,
    run_convention,
    run_doc_drift,
    run_incident_pattern,
    run_risk,
]


async def build_context_preview(req: VerifyRequest) -> dict:
    """Show what would be sent to agents — no LLM calls."""
    repo = settings.resolve_repo_path(req.repo_path)
    scope = resolve_scope(repo, req)
    g = build_graph_cached(repo)
    affected = graph_indexer.affected_paths(scope.changed_paths, g)
    excerpt = graph_indexer.graph_excerpt(g, affected)
    corpus = load_corpus()
    chunks = retrieve(
        f"{scope.diff_summary}\n{' '.join(scope.changed_paths)}",
        corpus,
        top_k=5,
        changed_paths=scope.changed_paths,
    )
    warnings: list[str] = []
    if scope.warning:
        warnings.append(scope.warning)
    if corpus_weak(chunks):
        warnings.append(
            "Corpus has weak relevance to this change — doc-based findings may be unreliable. "
            "Graph checks still apply. For repo-specific rules, set TRUSTLOOP_CORPUS_PATH in .env "
            "to a local docs folder (not committed)."
        )
    return {
        "repo_path": str(repo),
        "used_git_diff": scope.used_git,
        "warning": scope.warning,
        "changed_paths": scope.changed_paths,
        "affected_paths": affected,
        "graph_excerpt": excerpt,
        "diff_summary_preview": scope.diff_summary[:4000],
        "retrieved_chunks": [c.model_dump() for c in chunks],
        "corpus_max_score": corpus_relevance(chunks),
        "warnings": warnings,
        "agents_planned": len(AGENT_RUNNERS),
        "llm_mode": "mock" if settings.use_mock else "cerebras",
        "graph_stats": {
            "nodes": len(g.get("nodes", [])),
            "edges": len(g.get("edges", [])),
            "cached_files": g.get("cached_files"),
        },
    }


async def run_verification(req: VerifyRequest) -> VerificationRun:
    t0 = time.perf_counter()
    repo = settings.resolve_repo_path(req.repo_path)

    t_index = time.perf_counter()
    scope = resolve_scope(repo, req)
    changed = scope.changed_paths
    g = build_graph_cached(repo)
    affected = graph_indexer.affected_paths(changed, g)
    excerpt = graph_indexer.graph_excerpt(g, affected)
    diff = scope.diff_summary
    indexing_ms = int((time.perf_counter() - t_index) * 1000)

    t_ret = time.perf_counter()
    corpus = load_corpus()
    query = f"{diff}\n{' '.join(changed)}"
    chunks = retrieve(query, corpus, top_k=5, changed_paths=changed)
    max_corpus_score = corpus_relevance(chunks)
    weak_corpus = corpus_weak(chunks)
    retrieval_ms = int((time.perf_counter() - t_ret) * 1000)

    warnings: list[str] = []
    if scope.warning:
        warnings.append(scope.warning)
    if weak_corpus:
        warnings.append(
            "Corpus has weak relevance to this change — doc-based findings may be unreliable. "
            "Graph checks still apply. For repo-specific rules, set TRUSTLOOP_CORPUS_PATH in .env "
            "to a local docs folder (not committed)."
        )

    ctx = base.AgentContext(
        trigger=req.trigger.value,
        diff_summary=diff,
        changed_paths=changed,
        graph_excerpt=excerpt,
        corpus_chunks=chunks,
    )

    t_par = time.perf_counter()
    raw_results = await asyncio.gather(
        *[runner(ctx) for runner in AGENT_RUNNERS],
        return_exceptions=True,
    )
    parallel_ms = int((time.perf_counter() - t_par) * 1000)

    agent_results: list[AgentResult] = []
    timeline: list[AgentTimelineEntry] = []
    verification_incomplete = False

    for r in raw_results:
        if isinstance(r, Exception):
            verification_incomplete = True
            timeline.append(
                AgentTimelineEntry(agent="unknown", status="error", latency_ms=0, error=str(r))
            )
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
        overall_confidence=confidence_scoring.overall_confidence(
            findings, verification_incomplete, corpus_weak=weak_corpus
        ),
        verification_incomplete=verification_incomplete,
        warnings=warnings,
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
            files_checked=len(affected),
            citations_consulted=len(chunks),
            agents_run=len(timeline),
            corpus_max_score=max_corpus_score,
        ),
    )
