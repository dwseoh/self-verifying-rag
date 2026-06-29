"""Discover local git repositories on the machine running the backend."""

from __future__ import annotations

import os
from pathlib import Path

from backend.config import settings


def _is_git_repo(path: Path) -> bool:
    return (path / ".git").exists()


def discover_git_repos(
    query: str = "",
    max_depth: int = 4,
    max_results: int = 30,
) -> list[dict]:
    roots = settings.discovery_roots()
    q = query.strip().lower()
    found: list[dict] = []
    seen: set[str] = set()

    for root in roots:
        if not root.exists():
            continue
        if _is_git_repo(root):
            key = str(root.resolve())
            if key not in seen and (not q or q in key.lower() or q in root.name.lower()):
                seen.add(key)
                found.append(_repo_entry(root))
            if len(found) >= max_results:
                return found

        try:
            for dirpath, dirnames, _ in os.walk(root, topdown=True, followlinks=False):
                depth = dirpath[len(str(root)) :].count(os.sep)
                if depth >= max_depth:
                    dirnames.clear()
                    continue
                # Skip heavy / hidden dirs
                dirnames[:] = [
                    d
                    for d in dirnames
                    if d not in {".git", "node_modules", ".next", "venv", ".venv", "__pycache__"}
                    and not d.startswith(".")
                ]
                path = Path(dirpath)
                if not _is_git_repo(path):
                    continue
                key = str(path.resolve())
                if key in seen:
                    continue
                if q and q not in key.lower() and q not in path.name.lower():
                    continue
                seen.add(key)
                found.append(_repo_entry(path))
                if len(found) >= max_results:
                    return found
        except PermissionError:
            continue

    return found


def _repo_entry(path: Path) -> dict:
    name = path.name
    branch = "main"
    head = path / ".git" / "HEAD"
    if head.exists():
        text = head.read_text(encoding="utf-8").strip()
        if text.startswith("ref: refs/heads/"):
            branch = text.split("/")[-1]
    return {
        "name": name,
        "path": str(path.resolve()),
        "default_branch": branch,
    }
