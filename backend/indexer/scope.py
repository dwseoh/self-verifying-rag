"""Resolve what to verify: git diff vs explicit paths."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from backend.indexer import git
from backend.indexer.graph import diff_summary_for_paths
from backend.models import VerifyRequest


@dataclass
class VerifyScope:
    changed_paths: list[str]
    diff_summary: str
    used_git: bool


def resolve_scope(repo: Path, req: VerifyRequest) -> VerifyScope:
    """
    Priority:
    1. req.diff_summary (explicit)
    2. git diff base_ref...head_ref when repo is a git checkout
    3. req.changed_paths file contents
    4. default checkout.py
    """
    if req.diff_summary:
        paths = req.changed_paths or ["apps/web/checkout.py"]
        return VerifyScope(changed_paths=paths, diff_summary=req.diff_summary, used_git=False)

    if git.is_git_repo(repo) and (req.base_ref or req.head_ref):
        try:
            paths = req.changed_paths or git.changed_files(repo, req.base_ref, req.head_ref)
            if not paths:
                paths = req.changed_paths or ["apps/web/checkout.py"]
            diff = git.diff_text(repo, req.base_ref, req.head_ref, paths if req.changed_paths else None)
            if not diff.strip():
                diff = diff_summary_for_paths(repo, paths)
            return VerifyScope(changed_paths=paths, diff_summary=diff, used_git=True)
        except git.GitError:
            pass

    paths = req.changed_paths or ["apps/web/checkout.py"]
    return VerifyScope(
        changed_paths=paths,
        diff_summary=diff_summary_for_paths(repo, paths),
        used_git=False,
    )
