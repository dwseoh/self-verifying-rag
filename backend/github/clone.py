"""Clone GitHub repositories for verification (uses public clone URL or token)."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from backend.config import settings


def clone_github_repo(
    full_name: str,
    repository_id: str,
    default_branch: str = "main",
    token: str | None = None,
) -> Path:
    """Clone or update repo under trustloop_clones_path/{repository_id}."""
    dest = settings.trustloop_clones_path / repository_id
    dest.parent.mkdir(parents=True, exist_ok=True)

    url = f"https://github.com/{full_name}.git"
    if token:
        url = f"https://x-access-token:{token}@github.com/{full_name}.git"

    env = os.environ.copy()
    if token:
        env["GIT_TERMINAL_PROMPT"] = "0"

    if dest.exists() and (dest / ".git").exists():
        subprocess.run(
            ["git", "-C", str(dest), "fetch", "--all", "--prune"],
            check=True,
            capture_output=True,
            env=env,
        )
        subprocess.run(
            ["git", "-C", str(dest), "checkout", default_branch],
            check=False,
            capture_output=True,
            env=env,
        )
        subprocess.run(
            ["git", "-C", str(dest), "pull", "--ff-only"],
            check=False,
            capture_output=True,
            env=env,
        )
        return dest.resolve()

    if dest.exists():
        import shutil

        shutil.rmtree(dest)

    subprocess.run(
        ["git", "clone", "--depth", "1", "--branch", default_branch, url, str(dest)],
        check=True,
        capture_output=True,
        env=env,
    )
    return dest.resolve()
