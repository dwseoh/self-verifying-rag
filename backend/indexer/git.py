"""Git diff helpers — scope verification to what changed between refs."""

from __future__ import annotations

import subprocess
from pathlib import Path


class GitError(RuntimeError):
    pass


def _run_git(repo: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=repo,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise GitError(str(exc)) from exc


def is_git_repo(repo: Path) -> bool:
    try:
        _run_git(repo, "rev-parse", "--git-dir")
        return True
    except GitError:
        return False


def changed_files(repo: Path, base_ref: str, head_ref: str) -> list[str]:
    """Files changed between base and head (Python only for MVP verify scope)."""
    out = _run_git(repo, "diff", "--name-only", f"{base_ref}...{head_ref}")
    files = [line.strip() for line in out.splitlines() if line.strip()]
    return [f for f in files if f.endswith(".py")]


def diff_text(repo: Path, base_ref: str, head_ref: str, paths: list[str] | None = None) -> str:
    """Unified diff between refs, optionally scoped to paths."""
    args = ["diff", f"{base_ref}...{head_ref}", "--"]
    if paths:
        args.extend(paths)
    else:
        args.append(".")
    return _run_git(repo, *args)
