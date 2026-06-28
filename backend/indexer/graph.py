"""Deterministic import graph for demo_repo. MVP: Python imports only."""

from __future__ import annotations

import ast
import re
from pathlib import Path

from backend.config import settings


def _read_file(repo: Path, rel: str) -> str:
    path = repo / rel
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def extract_imports(source: str, file_path: str) -> list[tuple[str, str]]:
    """Return list of (file_path, imported_module) edges."""
    edges: list[tuple[str, str]] = []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return edges

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                edges.append((file_path, alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            edges.append((file_path, node.module))
    return edges


def build_graph(repo_path: Path | None = None) -> dict:
    repo = repo_path or settings.trustloop_repo_path
    nodes: set[str] = set()
    edges: list[dict] = []

    for py_file in repo.rglob("*.py"):
        rel = str(py_file.relative_to(repo))
        nodes.add(rel)
        source = py_file.read_text(encoding="utf-8")
        for _, mod in extract_imports(source, rel):
            edges.append({"from": rel, "to": mod, "kind": "import"})

    return {"nodes": sorted(nodes), "edges": edges}


def diff_summary_for_paths(repo_path: Path, changed_paths: list[str]) -> str:
    parts: list[str] = []
    for rel in changed_paths:
        content = _read_file(repo_path, rel)
        parts.append(f"--- {rel} ---\n{content}")
    return "\n\n".join(parts)


def affected_paths(changed_paths: list[str], graph: dict) -> list[str]:
    """1-hop neighbors via import edges (heuristic)."""
    affected = set(changed_paths)
    for edge in graph.get("edges", []):
        if edge["from"] in changed_paths:
            affected.add(edge["to"])
        if edge["to"] in changed_paths:
            affected.add(edge["from"])
    return sorted(affected)


def graph_excerpt(graph: dict, paths: list[str], limit: int = 30) -> str:
    relevant = [e for e in graph.get("edges", []) if e["from"] in paths or e["to"] in paths]
    return "\n".join(f"{e['from']} -> {e['to']}" for e in relevant[:limit])


def detect_boundary_hint(diff_text: str) -> bool:
    """True when web layer directly imports packages.payments (demo violation)."""
    in_web = "apps/web" in diff_text or "apps\\web" in diff_text
    if not in_web:
        return False
    return bool(
        re.search(
            r"(from\s+packages\.payments|import\s+packages\.payments)",
            diff_text,
        )
    )
