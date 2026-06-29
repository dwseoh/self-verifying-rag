"""Resolve what to verify: git diff vs explicit paths."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from backend.config import settings
from backend.indexer import git
from backend.indexer.graph import diff_summary_for_paths
from backend.models import VerifyRequest

_DEMO_DEFAULT = "apps/web/checkout.py"
_PRIORITY_DIRS = ("src/", "app/", "lib/", "components/", "pages/", "api/", "backend/", "frontend/src/")
_CODE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".c", ".cpp", ".h", ".hpp"}


def _snapshot_max_files() -> int:
    return max(1, settings.trustloop_snapshot_max_files)


def _normalize_prefix(prefix: str | None) -> str | None:
    if not prefix or not prefix.strip():
        return None
    p = prefix.strip().replace("\\", "/").lstrip("./")
    return p if p.endswith("/") else f"{p}/"


def _filter_snapshot_prefix(paths: list[str], prefix: str | None) -> list[str]:
    norm_prefix = _normalize_prefix(prefix)
    if not norm_prefix:
        return paths
    out: list[str] = []
    bare = norm_prefix.rstrip("/")
    for rel in paths:
        norm = rel.replace("\\", "/")
        if norm.startswith(norm_prefix) or norm == bare:
            out.append(rel)
    return out


def _prioritize_snapshot_paths(paths: list[str]) -> list[str]:
    def sort_key(p: str) -> tuple[int, str]:
        norm = p.replace("\\", "/")
        ext = Path(norm).suffix.lower()
        score = 2
        if any(norm.startswith(d) for d in _PRIORITY_DIRS):
            score = 0
        elif ext in _CODE_EXTS:
            score = 1
        if ext == ".md":
            score += 1
        if ext in {".css", ".scss"}:
            score += 1
        return (score, norm)

    return sorted(paths, key=sort_key)


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
    2. scope_mode: unstaged / staged / branch / snapshot (git)
    3. req.changed_paths file contents
    4. demo checkout.py only if that file exists in this repo
    """
    if req.diff_summary:
        paths = req.changed_paths or ([_DEMO_DEFAULT] if _default_path(repo) else [])
        return VerifyScope(changed_paths=paths, diff_summary=req.diff_summary, used_git=False)

    mode = getattr(req, "scope_mode", "branch") or "branch"

    if git.is_git_repo(repo):
        try:
            if mode == "snapshot":
                ref = (req.head_ref or req.base_ref or "main").strip() or "main"
                prefix = req.snapshot_prefix
                if req.changed_paths:
                    paths = list(req.changed_paths)
                else:
                    paths = _filter_snapshot_prefix(git.files_at_ref(repo, ref), prefix)
                warning = None
                if not paths:
                    hint = f" under {prefix!r}" if prefix else ""
                    return VerifyScope(
                        changed_paths=[],
                        diff_summary="",
                        used_git=True,
                        warning=f"No scoped files found at {ref}{hint}.",
                    )
                total = len(paths)
                max_files = _snapshot_max_files()
                paths = _prioritize_snapshot_paths(paths)
                if total > max_files:
                    prefix_note = f" matching {prefix!r}" if prefix else ""
                    warning = (
                        f"Snapshot capped at {max_files} of {total} scoped files at {ref}{prefix_note}. "
                        "Narrow with snapshot path prefix (e.g. src/) or raise TRUSTLOOP_SNAPSHOT_MAX_FILES."
                    )
                    paths = paths[:max_files]
                diff = git.snapshot_summary(repo, ref, paths)
                return VerifyScope(
                    changed_paths=paths,
                    diff_summary=diff,
                    used_git=True,
                    warning=warning,
                )

            if mode == "unstaged":
                paths = list(req.changed_paths) if req.changed_paths else git.working_tree_files(repo, staged=False)
                if not paths:
                    return VerifyScope(
                        changed_paths=[],
                        diff_summary="",
                        used_git=True,
                        warning="No unstaged source changes in working tree.",
                    )
                diff = git.working_tree_diff(repo, paths if req.changed_paths else None, staged=False)
                if not diff.strip():
                    diff = diff_summary_for_paths(repo, paths)
                return VerifyScope(changed_paths=paths, diff_summary=diff, used_git=True)

            if mode == "staged":
                paths = list(req.changed_paths) if req.changed_paths else git.working_tree_files(repo, staged=True)
                if not paths:
                    return VerifyScope(
                        changed_paths=[],
                        diff_summary="",
                        used_git=True,
                        warning="No staged source changes.",
                    )
                diff = git.working_tree_diff(repo, paths if req.changed_paths else None, staged=True)
                if not diff.strip():
                    diff = diff_summary_for_paths(repo, paths)
                return VerifyScope(changed_paths=paths, diff_summary=diff, used_git=True)

            if mode == "branch" and (req.base_ref or req.head_ref):
                paths = list(req.changed_paths) if req.changed_paths else git.changed_files(repo, req.base_ref, req.head_ref)
                warning = None
                if not paths and not req.changed_paths:
                    fallback = _default_path(repo)
                    if fallback:
                        paths = [fallback]
                    else:
                        warning = (
                            f"No changed source files between {req.base_ref}...{req.head_ref}. "
                            "Try unstaged scope or pass specific paths."
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

    if mode == "paths" or req.changed_paths:
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
