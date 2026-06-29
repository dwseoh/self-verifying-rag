"""Git diff helpers — scope verification to what changed between refs."""

from __future__ import annotations

import subprocess
from pathlib import Path

from backend.indexer.source_files import is_source_file

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
    """Source files changed between base and head (Python + C/C++)."""
    out = _run_git(repo, "diff", "--name-only", f"{base_ref}...{head_ref}")
    files = [line.strip() for line in out.splitlines() if line.strip()]
    return [f for f in files if is_source_file(Path(f))]


def working_tree_files(repo: Path, staged: bool = False) -> list[str]:
    """Unstaged or staged source files in the working tree."""
    args = ["diff", "--name-only"]
    if staged:
        args.insert(1, "--cached")
    out = _run_git(repo, *args)
    files = [line.strip() for line in out.splitlines() if line.strip()]
    return [f for f in files if is_source_file(Path(f))]


def working_tree_diff(repo: Path, paths: list[str] | None = None, staged: bool = False) -> str:
    args = ["diff"]
    if staged:
        args.append("--cached")
    args.append("--")
    args.extend(paths if paths else ["."])
    return _run_git(repo, *args)


def diff_text(repo: Path, base_ref: str, head_ref: str, paths: list[str] | None = None) -> str:
    """Unified diff between refs, optionally scoped to paths."""
    args = ["diff", f"{base_ref}...{head_ref}", "--"]
    if paths:
        args.extend(paths)
    else:
        args.append(".")
    return _run_git(repo, *args)
