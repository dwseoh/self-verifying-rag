"""Resolve what to verify: git diff vs explicit paths."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from backend.indexer import git
from backend.indexer.graph import diff_summary_for_paths
from backend.models import VerifyRequest

_DEMO_DEFAULT = "apps/web/checkout.py"


@dataclass
class VerifyScope:
    changed_paths: list[str]
    diff_summary: str
    used_git: bool
    warning: str | None = None


def _default_path(repo: Path) -> str:
    """Demo repo default only — never use Northstar paths for other repos."""
    demo = (repo / _DEMO_DEFAULT).exists()
    return _DEMO_DEFAULT if demo else ""


def resolve_scope(repo: Path, req: VerifyRequest) -> VerifyScope:
    """
    Priority:
    1. req.diff_summary (explicit)
    2. git diff base_ref...head_ref when repo is a git checkout
    3. req.changed_paths file contents
    4. demo checkout.py only if that file exists in this repo
    """
    if req.diff_summary:
        paths = req.changed_paths or ([_DEMO_DEFAULT] if _default_path(repo) else [])
        return VerifyScope(changed_paths=paths, diff_summary=req.diff_summary, used_git=False)

    if git.is_git_repo(repo) and (req.base_ref or req.head_ref):
        try:
            paths = list(req.changed_paths) if req.changed_paths else git.changed_files(repo, req.base_ref, req.head_ref)
            warning = None
            if not paths and not req.changed_paths:
                fallback = _default_path(repo)
                if fallback:
                    paths = [fallback]
                else:
                    warning = (
                        f"No changed source files between {req.base_ref}...{req.head_ref}. "
                        "Pass changed_paths explicitly or compare different refs."
                    )
                    return VerifyScope(
                        changed_paths=[],
                        diff_summary="",
                        used_git=True,
                        warning=warning,
                    )
            diff = git.diff_text(repo, req.base_ref, req.head_ref, paths if req.changed_paths else None)
            if not diff.strip():
                diff = diff_summary_for_paths(repo, paths)
            return VerifyScope(changed_paths=paths, diff_summary=diff, used_git=True, warning=warning)
        except git.GitError:
            pass

    fallback = _default_path(repo)
    paths = req.changed_paths or ([fallback] if fallback else [])
    if not paths:
        return VerifyScope(
            changed_paths=[],
            diff_summary="",
            used_git=False,
            warning="No changed_paths provided and repo has no demo checkout default.",
        )
    return VerifyScope(
        changed_paths=paths,
        diff_summary=diff_summary_for_paths(repo, paths),
        used_git=False,
    )
