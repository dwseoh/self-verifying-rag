"""MCP server — local pipeline or remote API via TRUSTLOOP_API_URL."""

from __future__ import annotations

import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

from backend.models import TriggerType, VerifyRequest
from backend.pipeline.orchestrator import run_verification
from backend.retrieval.retriever import load_corpus, retrieve
from backend.storage.run_cache import get_last_run, set_last_run

mcp = FastMCP("trustloop")

API_URL = os.environ.get("TRUSTLOOP_API_URL", "").rstrip("/")
DEFAULT_REPO = os.environ.get("TRUSTLOOP_REPO_PATH", "")


def _use_remote() -> bool:
    return bool(API_URL)


async def _remote_verify(body: dict) -> dict:
    async with httpx.AsyncClient(timeout=300.0) as client:
        res = await client.post(f"{API_URL}/api/verify", json=body)
        res.raise_for_status()
        return res.json()


@mcp.tool()
async def verify_diff(
    repo_path: str = "",
    changed_paths: list[str] | None = None,
    base_ref: str = "main",
    head_ref: str = "HEAD",
    trigger: str = "manual",
) -> str:
    """Run TrustLoop verification. Uses TRUSTLOOP_API_URL when set, else local pipeline."""
    path = repo_path or DEFAULT_REPO
    if not path:
        return json.dumps(
            {
                "error": "repo_path required — set TRUSTLOOP_REPO_PATH or pass repo_path to verify_diff",
            }
        )
    body = {
        "repo_path": path,
        "changed_paths": changed_paths or [],
        "base_ref": base_ref,
        "head_ref": head_ref,
        "trigger": trigger,
    }

    if _use_remote():
        run = await _remote_verify(body)
        return json.dumps(run)

    req = VerifyRequest(
        repo_path=path,
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
    if _use_remote():
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.get(f"{API_URL}/api/findings/latest")
            res.raise_for_status()
            data = res.json()
            return json.dumps(data.get("findings", data), indent=2)

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
