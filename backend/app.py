import json
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.config import ROOT, settings
from backend.llm.cerebras_client import check_llm_connection
from backend.models import VerificationRun, VerifyRequest, AddRuleRequest
from backend.pipeline.orchestrator import build_context_preview, run_verification
from backend.storage.json_store import JsonStore
from backend.storage.run_cache import get_last_run, set_last_run
from pydantic import BaseModel

app = FastAPI(
    title="TrustLoop",
    version="0.1.0",
    description="Ambient code assurance API. Person B: see backend/README.md",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = JsonStore()


def _load_fixture(name: str) -> VerificationRun:
    path = ROOT / "fixtures" / name
    return VerificationRun.model_validate_json(path.read_text(encoding="utf-8"))


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "mock_mode": settings.use_mock,
        "llm_mode": "mock" if settings.use_mock else "cerebras",
        "fixture_api": settings.trustloop_fixture_api,
        "model": settings.cerebras_model,
        "repo_path": str(settings.trustloop_repo_path),
    }


@app.get("/api/repos/index")
async def repo_index(repo_path: str = Query(...), corpus_path: str | None = None) -> dict:
    """Graph ingestion stats + auto-discovered corpus for dashboard."""
    from backend.api.repo_info import repo_index_summary

    return repo_index_summary(repo_path, corpus_path)


@app.post("/api/repos/rules")
async def add_rule(req: AddRuleRequest) -> dict:
    """Append a rule section to the repo-local corpus (docs/trustloop_corpus/)."""
    from backend.retrieval.corpus_discovery import append_rule

    repo = settings.resolve_repo_path(req.repo_path)
    return append_rule(
        repo,
        citation_id=req.citation_id,
        section_title=req.section_title,
        body=req.body,
        filename=req.filename,
    )


@app.get("/api/repos/discover")
async def discover_repos(
    q: str = Query(default=""),
    max_results: int = Query(default=30, le=50),
) -> dict:
    from backend.api.discover import discover_git_repos

    return {"repos": discover_git_repos(query=q, max_results=max_results)}


class GitHubCloneRequest(BaseModel):
    full_name: str
    repository_id: str
    default_branch: str = "main"
    token: str | None = None


@app.post("/api/github/clone")
async def github_clone(req: GitHubCloneRequest) -> dict:
    from backend.github.clone import clone_github_repo

    token = req.token or settings.github_clone_token or None
    path = clone_github_repo(
        req.full_name,
        req.repository_id,
        default_branch=req.default_branch,
        token=token,
    )
    return {"path": str(path), "full_name": req.full_name}


@app.get("/api/mcp/config")
async def mcp_config(
    request: Request,
    repo_path: str | None = Query(default=None),
    api_url: str | None = Query(default=None),
) -> dict:
    """Cursor MCP snippet — uses install script, no hardcoded dev paths when api_url set."""
    public_api = (
        api_url
        or settings.trustloop_public_api_url
        or str(request.base_url).rstrip("/")
    )
    install_url = f"{public_api.replace('/backend', '')}/api/mcp/install.sh"
    if repo_path:
        install_url += f"?repo_path={repo_path}"

    cursor_block = {
        "mcpServers": {
            "trustloop": {
                "command": "bash",
                "args": ["-c", f"curl -fsSL '{install_url}' | bash"],
                "env": {
                    "TRUSTLOOP_API_URL": public_api,
                    "TRUSTLOOP_REPO_PATH": repo_path or "",
                    "TRUSTLOOP_GIT_REPO": settings.trustloop_git_repo,
                },
            }
        }
    }
    return {
        "server_name": "trustloop",
        "mode": "install_script",
        "install_url": install_url,
        "install_command": f"curl -fsSL '{install_url}' | bash",
        "api_url": public_api,
        "default_repo_path": repo_path,
        "tools": [
            {
                "name": "verify_diff",
                "description": "Run verification on repo_path with optional changed_paths and git refs",
            },
            {"name": "get_findings", "description": "Findings from the last verify_diff call"},
            {"name": "search_engineering_corpus", "description": "Keyword search over rules corpus"},
        ],
        "cursor_config_json": cursor_block,
        "cursor_config_path": "~/.cursor/mcp.json",
    }


@app.get("/health/llm")
async def health_llm() -> dict:
    """Live Cerebras connectivity check (uses API key)."""
    return await check_llm_connection()


@app.get("/api/schema/fixture")
async def fixture_sample() -> dict:
    """Static VerificationRun samples for frontend development."""
    return {
        "clean": json.loads((ROOT / "fixtures" / "verification_run_clean.json").read_text()),
        "violation": json.loads(
            (ROOT / "fixtures" / "verification_run_violation.json").read_text()
        ),
    }


@app.post("/api/verify/preview")
async def verify_preview(req: VerifyRequest) -> dict:
    """
    Debug endpoint: shows changed files, graph excerpt, and corpus chunks
  without calling Cerebras. Use this to understand context assembly.
    """
    return await build_context_preview(req)


@app.post("/api/verify", response_model=VerificationRun)
async def verify(
    req: VerifyRequest,
    fixture: str | None = Query(
        default=None,
        description="Use static fixture: 'clean' or 'violation' (skips engine)",
    ),
) -> VerificationRun:
    """Primary MVP endpoint. Runs full pipeline unless fixture= query param set."""
    if fixture in {"clean", "violation"} or settings.trustloop_fixture_api:
        if fixture == "clean":
            name = "verification_run_clean.json"
        elif fixture == "violation":
            name = "verification_run_violation.json"
        else:
            from backend.indexer.graph import detect_boundary_hint, diff_summary_for_paths

            repo = settings.resolve_repo_path(req.repo_path)
            changed = req.changed_paths or ["apps/web/checkout.py"]
            diff = diff_summary_for_paths(repo, changed)
            name = (
                "verification_run_violation.json"
                if detect_boundary_hint(diff)
                else "verification_run_clean.json"
            )
        run = _load_fixture(name)
        store.append_jsonl("runs.jsonl", {"id": run.id, "trigger": run.trigger.value, "fixture": True})
        return run

    run = await run_verification(req)
    set_last_run(run)
    store.append_jsonl("runs.jsonl", {"id": run.id, "trigger": run.trigger.value})
    return run


@app.get("/api/findings/latest")
async def latest_findings() -> dict:
    """Most recent VerificationRun (for UI polling / MCP companion)."""
    run = get_last_run()
    if not run:
        return {"findings": [], "message": "No verification run yet"}
    return run.model_dump()
