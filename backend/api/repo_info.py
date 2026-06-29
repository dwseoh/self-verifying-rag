"""Repo index + corpus introspection for the dashboard."""

from __future__ import annotations

from pathlib import Path

from backend.config import settings
from backend.indexer.graph_cache import build_graph_cached
from backend.indexer import git
from backend.retrieval.corpus_discovery import discover_corpus_path, list_corpus_files
from backend.retrieval.retriever import load_corpus


def repo_index_summary(repo_path: str, corpus_override: str | None = None) -> dict:
    repo = settings.resolve_repo_path(repo_path)
    graph = build_graph_cached(repo)
    corpus_path = discover_corpus_path(repo, corpus_override)
    chunks = load_corpus(corpus_path)

    py_nodes = sum(1 for n in graph.get("nodes", []) if n.endswith(".py"))
    c_nodes = sum(
        1
        for n in graph.get("nodes", [])
        if n.endswith((".c", ".cpp", ".cc", ".h", ".hpp"))
    )

    return {
        "repo_path": str(repo),
        "is_git": git.is_git_repo(repo),
        "graph": {
            "nodes": len(graph.get("nodes", [])),
            "edges": len(graph.get("edges", [])),
            "cached_files": graph.get("cached_files", 0),
            "python_files": py_nodes,
            "c_cpp_files": c_nodes,
        },
        "corpus": {
            "path": str(corpus_path),
            "auto_discovered": corpus_override is None,
            "section_count": len(chunks),
            "documents": list_corpus_files(corpus_path),
        },
    }
