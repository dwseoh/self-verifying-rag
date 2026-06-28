import json
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.config import ROOT, settings
from backend.models import VerificationRun, VerifyRequest
from backend.pipeline.orchestrator import build_context_preview, run_verification
from backend.storage.json_store import JsonStore

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
        "fixture_api": settings.trustloop_fixture_api,
        "model": settings.cerebras_model,
        "repo_path": str(settings.trustloop_repo_path),
    }


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
    store.append_jsonl("runs.jsonl", {"id": run.id, "trigger": run.trigger.value})
    return run
