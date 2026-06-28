# TrustLoop Implementation Guide

**Read this first.** Clear MVP boundaries, who builds what, and what comes later.

**Team size:** 2 people  
**Rule:** MVP must demo end-to-end before any add-on work starts.

---

## 1. Database decision

### MVP: **No Postgres / Neon**

Use **local JSON files** under `data/store/` (see `backend/storage/json_store.py`).

| Need | MVP approach |
|------|----------------|
| Verification run history | Optional append to `data/store/runs.jsonl` |
| Finding acknowledgments | `data/store/reviews.json` (add-on A5+) |
| Architecture facts | `data/store/architecture_facts.json` (add-on A5+) |
| Doc suggestion status | `data/store/suggestions.json` (add-on A4+) |

**Why not Neon for MVP:**

- Two people, ~24h — database setup, migrations, and connection pooling are distraction
- Demo runs **locally**; no multi-user auth or shared deployment requirement
- Corpus and demo repo are **files on disk**; retrieval is in-memory/keyword
- JSON is enough for approve/reject demo state

### When to add Postgres (Neon or other)

Add **after MVP**, if you:

- Deploy a shared dashboard (Vercel + serverless API) and need durable state across restarts
- Support multiple reviewers / tenants
- Store large verification audit history with query filters
- Run background workers that outlive a single machine

**Recommendation:** Neon is fine for **Phase 2 deployment** (add-on or post-hackathon). Use SQLAlchemy + asyncpg; keep the same Pydantic models at the API boundary. Do not block MVP on it.

### What lives in GitHub now vs database later

```txt
GITHUB (source of truth — commit these)
├── data/demo_repo/              # sample code to verify
├── data/engineering_corpus/     # ADRs, postmortems, CONTRIBUTING (markdown)
├── fixtures/                    # API/UI contract samples
└── backend/, frontend/, docs/

NOT IN GITHUB (runtime / secrets — gitignored)
├── .env                         # CEREBRAS_API_KEY
├── data/store/*.json            # graph cache, run log
├── data/orbital/                # local clones — never commit
├── data/clones/                 # local clones — never commit
└── .venv/, node_modules/
```

| Data | Now (git) | Later (DB) |
|------|-----------|------------|
| Policies, ADRs, postmortems | `engineering_corpus/*.md` | Can stay in git (docs-as-code) or sync from Confluence |
| Demo / target repo code | `demo_repo/` or real repo | Clone from GitHub at verify time |
| Import graph | Rebuilt in memory | Cache table or `repo_graph.json` → then DB |
| Corpus vectors (embeddings) | Not used in MVP | `pgvector` / Chroma / object store |
| Verification run audit | Optional `data/store/runs.jsonl` (local) | `verification_runs` table in Neon |
| Finding acks, arch facts, suggestions | `data/store/*.json` (local) | `reviews`, `architecture_facts` tables |

**You are not pushing a database to GitHub.** You are pushing **markdown + code** — the knowledge and code the system reasons over. A database later holds **operational state** (who approved what, run history), not the corpus itself.

Migration path: keep `VerificationRun` / `Finding` Pydantic models unchanged; swap `JsonStore` for a `PostgresStore` implementing the same read/write methods.

---

## 2. MVP scope (frozen)

### The only demo that must work

1. Open web dashboard.
2. Click **Verify** on `data/demo_repo/apps/web/checkout.py` (clean version) → no high-severity findings.
3. Add `from packages.payments.client import charge_customer` (or equivalent bad import).
4. Click **Verify** again.
5. Within **&lt; 2 seconds**: **High** finding citing `ARCH_ADR_004` and `INCIDENT_PM_2024_03`.
6. Agent timeline shows **3 agents** completing in **parallel**.

### MVP checklist

| # | Deliverable | Owner |
|---|-------------|-------|
| 1 | `data/demo_repo/` — web, api, payments layout | B |
| 2 | `data/engineering_corpus/` — ADR, postmortem, CONTRIBUTING | B |
| 3 | `fixtures/verification_run_*.json` | A |
| 4 | Pydantic models in `backend/models/` | A |
| 5 | `POST /api/verify` — real pipeline | A |
| 6 | Import graph indexer (`backend/indexer/`) | A |
| 7 | Keyword retriever (`backend/retrieval/`) | A |
| 8 | 3 agents on Cerebras (or mock) | A |
| 9 | Orchestrator + confidence + composer | A |
| 10 | Web UI: Verify, findings, timeline, citations | B |
| 11 | Mock mode when `CEREBRAS_API_KEY` missing | A |
| 12 | `docs/DEMO_SCRIPT.md` | B |

### MVP explicitly does NOT include

- Postgres / Neon / Redis
- MCP server
- File save watcher
- Git hooks / CI
- Architecture fact confirm UI
- Doc suggestions panel
- RCA swarm
- Policy Q&A (`POST /api/ask`)
- IDE extension packaging
- Vector DB (Chroma/FAISS) — keyword search is enough

---

## 3. Work split (2 people)

### Person A — Engine

Owns everything under `backend/` except nothing in `frontend/`.

```
Hour 0–2 (Phase 0)
  ├── Pydantic models + fixtures
  ├── FastAPI app + mock POST /api/verify → fixture
  └── .env.example, pyproject.toml

Hour 2–10 (Phase 1)
  ├── indexer/graph.py — Python imports
  ├── retrieval/ — load corpus, keyword search
  ├── llm/cerebras_client.py — see docs/CEREBRAS_GEMMA.md
  ├── agents/ — architecture_boundary, incident_pattern, risk
  ├── pipeline/orchestrator.py — asyncio.gather
  ├── scoring/confidence.py
  └── pipeline/composer.py

Hour 10–12 (Phase 2)
  ├── Mock mode polish
  └── Smoke test with B's UI
```

**Handoff to B (end of hour 2):** `VerificationRun` JSON shape is frozen; mock API URL `http://localhost:8000/api/verify`.

### Person B — Surface

Owns `frontend/`, `data/`, `fixtures/` (with A), `docs/DEMO_SCRIPT.md`.

```
Hour 0–2 (Phase 0)
  ├── UI shell from fixtures/verification_run_violation.json
  ├── demo_repo/ + engineering_corpus/ markdown
  └── Layout: findings | timeline | citations

Hour 2–10 (Phase 1)
  ├── Wire Verify → POST /api/verify
  ├── Pass changed_paths + repo_path in request body
  ├── Finding cards, severity colors, citation panel
  └── Agent timeline with per-agent ms

Hour 10–12 (Phase 2)
  ├── DEMO_SCRIPT.md
  ├── Clean vs violation toggle for checkout.py
  └── UI empty states + one polish pass
```

### Sync points (non-negotiable)

| When | What |
|------|------|
| **Hour 1** | Agree on `VerificationRun` JSON (use `fixtures/` as contract) |
| **Hour 2** | B's UI renders fixture; A's mock API returns same fixture |
| **Hour 6** | Midpoint: real indexer + retriever return data in API response (agents can still be stubbed) |
| **Hour 10** | Full pipeline works; B wires live data |
| **Hour 12** | Run demo twice; only then discuss add-ons |

### If only one person is free

Priority order: models → mock API → fixture UI → indexer → 1 agent (architecture_boundary) → orchestrator → remaining 2 agents.

---

## 4. Phases

### Phase 0 — Unblock (~2h)

**Goal:** UI and API speak the same JSON without LLM.

- [ ] Fixtures committed
- [ ] `uvicorn backend.app:app` returns mock verify response
- [ ] Frontend renders violation fixture

### Phase 1 — MVP core (~8h)

**Goal:** Real verify on demo violation.

- [ ] Indexer finds cross-package import
- [ ] Retriever returns ADR + postmortem chunks
- [ ] 3 parallel agents (or mock agents)
- [ ] UI shows live run

### Phase 2 — Harden (~2h)

**Goal:** Judge-ready demo.

- [x] `DEMO_SCRIPT.md`
- [x] Reset script for checkout.py
- [x] `GET /health/llm` — live Cerebras ping
- [ ] Error UI when API key missing (Person B)
- [ ] Demo run ×2 without failure

### Phase 3 — Sprint 3 backend (Add-ons A1–A3)

- [x] **A1** `scripts/watch-save.py` — debounced save → POST verify
- [x] **A2** Agents +2: `convention`, `doc_drift` (5 parallel verifiers)
- [x] **A3** MCP: `backend/mcp/server.py` + `scripts/run-mcp.sh`
- [x] LLM: retry, JSON repair, `check_llm_connection()`
- [x] `GET /api/findings/latest` for UI polling

### Phase 3+ — Add-ons (only after Phase 2)

| ID | Feature | A | B |
|----|---------|---|---|
| A1 | Save watcher | `scripts/watch-save.py` | Auto-refresh UI |
| A2 | +2 agents | convention, doc_drift | Timeline shows 5 |
| A3 | MCP | `backend/mcp/server.py` | — |
| A4 | Doc suggestions | gap_detector | Suggestions panel |
| A5 | Arch facts + **optional Neon** | fact_proposer, review_store | Confirm UI |
| A6 | Git/CI | hooks, verify-pr.sh | README |
| A7 | RCA swarm | rca_swarm.py | Demo button |
| A8 | Policy Q&A | `/api/ask` | Optional tab |

**Neon fits best at A5** if you need durable review state on a deployed URL. Still optional — JSON store works for local demo.

---

## 5. How to run MVP (local)

```bash
# Terminal 1 — API
cd /path/to/trustloop
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env   # add CEREBRAS_API_KEY or leave empty for mock
uvicorn backend.app:app --reload --port 8000

# Terminal 2 — UI (after B scaffolds frontend)
cd frontend && npm install && npm run dev
```

Verify manually:

```bash
curl -X POST http://localhost:8000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "data/demo_repo",
    "changed_paths": ["apps/web/checkout.py"],
    "trigger": "manual"
  }'
```

---

## 6. File map (MVP)

```txt
backend/
  app.py                 # FastAPI routes
  models/verification.py # Pydantic contracts
  llm/cerebras_client.py # Gemma calls — docs/CEREBRAS_GEMMA.md
  indexer/graph.py       # Import graph
  retrieval/             # Corpus load + search
  agents/                # 3 micro-verifiers
  pipeline/              # orchestrator, composer
  scoring/confidence.py
  storage/json_store.py  # MVP persistence (not Postgres)

data/
  demo_repo/             # Sample monorepo
  engineering_corpus/    # ADRs, incidents
  store/                 # JSON state (gitignored except .gitkeep)

fixtures/                # UI + mock API contract
frontend/                # Dashboard (Person B)
docs/
  IMPLEMENTATION.md      # this file
  CEREBRAS_GEMMA.md        # LLM API for agents
  PRD.md
  ARCHITECTURE.md
```

---

## 7. Agent implementation notes

- Every agent: one Cerebras call, JSON out, &lt; 200 lines.
- Use `response_format` + `json_schema` + `strict: true` — see `docs/CEREBRAS_GEMMA.md`.
- For MVP speed: **`reasoning_effort` omitted** (disabled by default on Gemma 4).
- Pass only scoped context: diff hunk, top 5 corpus chunks, small graph excerpt.
- On parse failure: return `AgentResult(status="error")`, do not crash orchestrator.

---

## 8. Related docs

| Doc | Purpose |
|-----|---------|
| `docs/CONCEPTS.md` | **Indexing, context, agents, surfaces — read if confused** |
| `docs/PRD.md` | Product requirements, add-on list |
| `docs/ARCHITECTURE.md` | Technical contracts, diagrams |
| `docs/CEREBRAS_GEMMA.md` | How to call Gemma on Cerebras |
| `docs/DEMO_SCRIPT.md` | Judge demo (Phase 2) |
| `CLAUDE.md` | Cursor/agent guardrails |
