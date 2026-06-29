"""Repo index + corpus introspection for the dashboard."""

from __future__ import annotations

from pathlib import Path

from backend.health.code_health import analyze_code_health
from backend.config import settings
from backend.indexer.graph_cache import build_graph_cached
from backend.indexer import git
from backend.retrieval.corpus_discovery import discover_corpus_path, list_corpus_files
from backend.retrieval.repo_knowledge import list_knowledge_sources, load_repo_knowledge, merge_knowledge_chunks
from backend.retrieval.retriever import load_corpus


def repo_index_summary(repo_path: str, corpus_override: str | None = None) -> dict:
    repo = settings.resolve_repo_path(repo_path)
    graph = build_graph_cached(repo)
    corpus_path = discover_corpus_path(repo, corpus_override)
    formal = load_corpus(corpus_path)
    repo_knowledge = load_repo_knowledge(repo)
    merged = merge_knowledge_chunks(formal, repo_knowledge)
    using_global_fallback = (
        corpus_path.resolve() == settings.trustloop_corpus_path.resolve() and not repo_knowledge
    )
    using_shared_default = corpus_path.resolve() == settings.trustloop_corpus_path.resolve()

    py_nodes = sum(1 for n in graph.get("nodes", []) if n.endswith(".py"))
    c_nodes = sum(
        1
        for n in graph.get("nodes", [])
        if n.endswith((".c", ".cpp", ".cc", ".h", ".hpp"))
    )
    web_nodes = sum(
        1
        for n in graph.get("nodes", [])
        if n.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"))
    )

    knowledge_sources = list_knowledge_sources(repo)
    health = analyze_code_health(repo)

    if knowledge_sources and using_shared_default:
        corpus_summary = (
            f"{len(knowledge_sources)} repo doc(s) (README, CLAUDE.md, …) "
            f"+ shared TrustLoop defaults"
        )
    elif knowledge_sources:
        corpus_summary = f"{len(knowledge_sources)} repo doc(s) + rules from {corpus_path.name}"
    elif using_shared_default:
        corpus_summary = "Shared TrustLoop default rules (no repo docs/trustloop_corpus yet)"
    else:
        corpus_summary = f"Rules from {corpus_path}"

    return {
        "repo_path": str(repo),
        "is_git": git.is_git_repo(repo),
        "graph": {
            "nodes": len(graph.get("nodes", [])),
            "edges": len(graph.get("edges", [])),
            "cached_files": graph.get("cached_files", 0),
            "python_files": py_nodes,
            "c_cpp_files": c_nodes,
            "web_files": web_nodes,
        },
        "corpus": {
            "path": str(corpus_path),
            "summary": corpus_summary,
            "auto_discovered": corpus_override is None,
            "using_global_fallback": using_global_fallback,
            "using_shared_default": using_shared_default,
            "section_count": len(merged),
            "formal_section_count": len(formal),
            "repo_knowledge_files": len(knowledge_sources),
            "knowledge_sources": knowledge_sources[:30],
            "documents": list_corpus_files(corpus_path),
        },
        "code_health": {
            "finding_count": len(health),
            "findings": health[:15],
        },
    }
