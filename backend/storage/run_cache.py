"""In-memory cache of the most recent verification run (for MCP get_findings)."""

from backend.models import VerificationRun

_last_run: VerificationRun | None = None


def set_last_run(run: VerificationRun) -> None:
    global _last_run
    _last_run = run


def get_last_run() -> VerificationRun | None:
    return _last_run
