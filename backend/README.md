# Backend — TrustLoop engine

## Run API

```bash
pip install -e ".[dev]"
cp .env.example .env
# Live LLM: CEREBRAS_API_KEY=... and TRUSTLOOP_MOCK=0

uvicorn backend.app:app --reload --port 8000
```

## LLM (Cerebras Gemma)

| Env | Behavior |
|-----|----------|
| `CEREBRAS_API_KEY` set + `TRUSTLOOP_MOCK=0` | **Live** — 5 parallel `gemma-4-31b` calls per verify |
| No key or `TRUSTLOOP_MOCK=1` | **Mock** — `fixtures/agent_mocks/*.json` |

Check connectivity:

```bash
curl http://localhost:8000/health/llm
pytest tests/test_llm_live.py   # needs CEREBRAS_API_KEY
```

All agents use `backend/llm/cerebras_client.py` → structured JSON (`json_schema`, `strict: true`).  
See `docs/CEREBRAS_GEMMA.md`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/verify` | Full pipeline (5 agents) |
| POST | `/api/verify/preview` | Context only, no LLM |
| GET | `/api/findings/latest` | Last run (UI polling) |
| GET | `/health/llm` | Ping Cerebras |

## Sprint 3 — triggers & MCP

```bash
# Manual
./scripts/verify.sh

# Branch diff
./scripts/verify-branch.sh data/demo_repo main feature/bad-payments-import

# Any repo
./scripts/verify-repo.sh /path/to/repo src/foo.py

# Save watcher (API must be running)
pip install -e .
python scripts/watch-save.py

# MCP for Cursor (stdio)
pip install -e ".[mcp]"
./scripts/run-mcp.sh
```

MCP tools: `verify_diff`, `get_findings`, `search_engineering_corpus`

## Agents (5 parallel)

1. `architecture_boundary`
2. `convention`
3. `doc_drift`
4. `incident_pattern`
5. `risk`

See `docs/HOW_TO_USE.md` for graph, corpus, and context assembly.
