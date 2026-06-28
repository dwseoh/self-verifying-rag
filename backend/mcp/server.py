"""MCP server — expose TrustLoop verify tools to Cursor / Claude Code (Add-on A3)."""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

from backend.models import TriggerType, VerifyRequest
from backend.pipeline.orchestrator import run_verification
from backend.retrieval.retriever import load_corpus, retrieve
from backend.storage.run_cache import get_last_run, set_last_run

mcp = FastMCP("trustloop")


@mcp.tool()
async def verify_diff(
    repo_path: str = "data/demo_repo",
    changed_paths: list[str] | None = None,
    base_ref: str = "main",
    head_ref: str = "HEAD",
    trigger: str = "manual",
) -> str:
    """Run full TrustLoop verification on a repo path or git ref range. Returns VerificationRun JSON."""
    req = VerifyRequest(
        repo_path=repo_path,
        changed_paths=changed_paths or [],
        base_ref=base_ref,
        head_ref=head_ref,
        trigger=TriggerType(trigger),
    )
    run = await run_verification(req)
    set_last_run(run)
    return run.model_dump_json()


@mcp.tool()
async def get_findings() -> str:
    """Return findings from the most recent verify_diff call."""
    run = get_last_run()
    if not run:
        return json.dumps({"findings": [], "message": "No run yet — call verify_diff first"})
    return json.dumps([f.model_dump() for f in run.findings], indent=2)


@mcp.tool()
async def search_engineering_corpus(query: str, top_k: int = 5) -> str:
    """Search ADRs, conventions, skills, and policies by keyword."""
    chunks = retrieve(query, load_corpus(), top_k=top_k)
    return json.dumps([c.model_dump() for c in chunks], indent=2)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
