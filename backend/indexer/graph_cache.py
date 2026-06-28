"""Incremental repo graph cache — re-parse only files whose mtime changed."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from backend.config import settings
from backend.indexer.graph import extract_imports

_CACHE_VERSION = 1


def _cache_path(repo: Path) -> Path:
    key = hashlib.sha256(str(repo.resolve()).encode()).hexdigest()[:16]
    return settings.trustloop_store_path / f"repo_graph_{key}.json"


def _file_mtime(path: Path) -> float:
    return path.stat().st_mtime


def build_graph_cached(repo_path: Path | None = None) -> dict:
    repo = (repo_path or settings.trustloop_repo_path).resolve()
    cache_file = _cache_path(repo)

    cached: dict = {"version": _CACHE_VERSION, "files": {}, "edges": []}
    if cache_file.exists():
        cached = json.loads(cache_file.read_text(encoding="utf-8"))

    if cached.get("version") != _CACHE_VERSION:
        cached = {"version": _CACHE_VERSION, "files": {}, "edges": []}

    files_meta: dict = cached.get("files", {})
    all_edges: list[dict] = []
    nodes: set[str] = set()
    seen_edges: set[tuple[str, str]] = set()

    py_files = list(repo.rglob("*.py"))
    current_paths = set()

    for py_file in py_files:
        rel = str(py_file.relative_to(repo))
        current_paths.add(rel)
        nodes.add(rel)
        mtime = _file_mtime(py_file)

        entry = files_meta.get(rel)
        if entry and entry.get("mtime") == mtime:
            for edge in entry.get("edges", []):
                key = (edge["from"], edge["to"])
                if key not in seen_edges:
                    seen_edges.add(key)
                    all_edges.append(edge)
            continue

        source = py_file.read_text(encoding="utf-8")
        file_edges = [
            {"from": rel, "to": mod, "kind": "import"}
            for _, mod in extract_imports(source, rel)
        ]
        files_meta[rel] = {"mtime": mtime, "edges": file_edges}
        for edge in file_edges:
            key = (edge["from"], edge["to"])
            if key not in seen_edges:
                seen_edges.add(key)
                all_edges.append(edge)

    # Drop deleted files from cache
    for stale in set(files_meta.keys()) - current_paths:
        del files_meta[stale]

    out = {"nodes": sorted(nodes), "edges": all_edges, "cached_files": len(files_meta)}
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(
        json.dumps({"version": _CACHE_VERSION, "files": files_meta, "edges": all_edges}, indent=2),
        encoding="utf-8",
    )
    return out
