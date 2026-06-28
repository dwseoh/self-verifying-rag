import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import ROOT, settings
from backend.models import VerificationRun, VerifyRequest
from backend.pipeline.orchestrator import run_verification
from backend.storage.json_store import JsonStore

app = FastAPI(title="TrustLoop", version="0.1.0")

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
        "model": settings.cerebras_model,
    }


@app.post("/api/verify", response_model=VerificationRun)
async def verify(req: VerifyRequest) -> VerificationRun:
    """Primary MVP endpoint. See docs/IMPLEMENTATION.md."""
    if settings.use_mock and not req.diff_summary:
        # Heuristic: return violation fixture if payments import in checkout
        repo = Path(req.repo_path) if req.repo_path else settings.trustloop_repo_path
        changed = req.changed_paths or ["apps/web/checkout.py"]
        from backend.indexer.graph import diff_summary_for_paths, detect_boundary_hint

        diff = diff_summary_for_paths(repo, changed)
        if detect_boundary_hint(diff):
            run = _load_fixture("verification_run_violation.json")
            store.append_jsonl("runs.jsonl", {"id": run.id, "trigger": run.trigger.value})
            return run
        return _load_fixture("verification_run_clean.json")

    run = await run_verification(req)
    store.append_jsonl("runs.jsonl", {"id": run.id, "trigger": run.trigger.value})
    return run
