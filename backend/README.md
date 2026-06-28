# Backend MVP — handoff for Person B

## Run API

```bash
cd ..   # repo root
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # TRUSTLOOP_MOCK=1 works without Cerebras key

uvicorn backend.app:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Fixture samples: http://localhost:8000/api/schema/fixture

## Primary endpoint

```http
POST /api/verify
Content-Type: application/json

{
  "repo_path": "data/demo_repo",
  "changed_paths": ["apps/web/checkout.py"],
  "trigger": "manual"
}
```

Response type: **`VerificationRun`** — see `backend/models/verification.py` and `fixtures/verification_run_violation.json`.

### Dev modes

| Env | Behavior |
|-----|----------|
| `TRUSTLOOP_MOCK=1` | Full pipeline; agents use `fixtures/agent_mocks/` (no API key) |
| `CEREBRAS_API_KEY=...` | Live Gemma calls |
| `TRUSTLOOP_FIXTURE_API=1` | `/api/verify` returns static fixtures only |
| `?fixture=clean\|violation` | One-off static fixture |

## Demo violation

```bash
./scripts/seed-violation.sh    # add bad import
./scripts/verify.sh            # POST verify
./scripts/reset-checkout.sh    # restore clean
```

## What the pipeline does

```txt
POST /api/verify
  → indexer: import graph + diff + subgraph
  → retriever: top 5 corpus chunks (keyword)
  → 3 parallel agents (asyncio.gather)
  → composer + confidence
  → VerificationRun JSON
```

## Types for frontend (`src/types/verification.ts`)

Mirror these from `VerificationRun`:

- `findings[]` — severity, confidence, title, explanation, citation_ids, evidence_snippets
- `agent_timeline[]` — agent, status, latency_ms
- `latency` — indexing_ms, retrieval_ms, parallel_verification_ms, total_ms
- `overall_confidence`, `risk_level`, `verification_incomplete`

See `docs/HOW_TO_USE.md` for graph, corpus, triggers, and testing on real repos.
