"""Deterministic dependency graph for Python and C/C++ sources."""

from __future__ import annotations

import re
from pathlib import Path

from backend.config import settings
from backend.indexer.source_files import edges_for_file, iter_source_files


def _read_file(repo: Path, rel: str) -> str:
    path = repo / rel
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def extract_imports(source: str, file_path: str) -> list[tuple[str, str]]:
    """Backward-compatible helper for tests — Python imports only."""
    from backend.indexer.source_files import extract_python_imports

    return [(e["from"], e["to"]) for e in extract_python_imports(source, file_path)]


def build_graph(repo_path: Path | None = None) -> dict:
    repo = repo_path or settings.trustloop_repo_path
    nodes: set[str] = set()
    edges: list[dict] = []

    for src in iter_source_files(repo):
        rel = str(src.relative_to(repo))
        nodes.add(rel)
        edges.extend(edges_for_file(src, repo))

    return {"nodes": sorted(nodes), "edges": edges}


def diff_summary_for_paths(repo_path: Path, changed_paths: list[str]) -> str:
    parts: list[str] = []
    for rel in changed_paths:
        content = _read_file(repo_path, rel)
        parts.append(f"--- {rel} ---\n{content}")
    return "\n\n".join(parts)


def affected_paths(changed_paths: list[str], graph: dict) -> list[str]:
    """1-hop neighbors via import/include edges."""
    affected = set(changed_paths)
    for edge in graph.get("edges", []):
        src, dst = edge["from"], edge["to"]
        if src in changed_paths:
            affected.add(dst)
        if dst in changed_paths:
            affected.add(src)
    return sorted(affected)


def graph_excerpt(graph: dict, paths: list[str], limit: int = 30) -> str:
    relevant = [e for e in graph.get("edges", []) if e["from"] in paths or e["to"] in paths]
    return "\n".join(
        f"{e['from']} -[{e.get('kind', 'edge')}]-> {e['to']}" for e in relevant[:limit]
    )


def detect_boundary_hint(diff_text: str) -> bool:
    """True when web layer directly imports packages.payments (demo violation)."""
    in_web = "apps/web" in diff_text or "apps\\web" in diff_text
    if not in_web:
        return False
    return bool(
        re.search(
            r"(from\s+packages\.payments|import\s+packages\.payments|#include\s+[\"<].*payments)",
            diff_text,
        )
    )
