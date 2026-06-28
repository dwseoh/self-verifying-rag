# TrustLoop Architecture

## 1. Architecture Summary

TrustLoop is a **latency-native ambient code assurance engine**. It verifies scoped code changes against a deterministic repo graph, a human-confirmed architecture map, and an engineering knowledge corpus (ADRs, conventions, postmortems, policies) — using **parallel micro-verifier agents** on Gemma via Cerebras.

Enterprise knowledge MCPs retrieve snippets when asked. TrustLoop **acts on events** (save, commit, PR, test failure) and returns evidence-backed findings with citations.

### Core principles

1. **Parallel, not serial** — All micro-verifiers for a request fan out via `asyncio.gather()`.
2. **Frequent, not only batch** — Scoped verification on save/commit; full pass on PR. Cerebras speed makes frequency viable.
3. **Deterministic graph first** — Repo structure and blast radius come from parsing, not LLM inference.
4. **Human-confirmed architecture facts** — LLM proposes boundaries; humans confirm before facts gate merges.
5. **Deterministic confidence** — Scores come from a fixed penalty formula, not an LLM opinion.
6. **Graceful degradation** — Agent failures yield partial results; never report high confidence when verification is incomplete.
7. **No auto-edits** — Findings and doc suggestions only; humans approve corpus updates.

---

## 2. High-Level System Diagram

```txt
                         TRIGGERS
    save (debounced) | post-commit | PR/CI | test-fail | manual
                              |
                              v
                    +-------------------+
                    |  Trigger Router   |  scope + agent set per event
                    +-------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
     +----------------+              +------------------+
     |  Repo Indexer  |              | Corpus Retriever |
     |  (deterministic)|              | (ADRs, PMs, etc)|
     +----------------+              +------------------+
              |                               |
              +---------------+---------------+
                              |
                              v
                    +-------------------+
                    |  Change Context   |
                    |  diff + subgraph  |
                    |  + corpus chunks  |
                    +-------------------+
                              |
     +------------------------+------------------------+
     |              PARALLEL MICRO-VERIFIERS            |
     |                    (Cerebras)                    |
     v           v           v           v           v
Architect.   Convention   Doc drift   Incident     Risk
boundary                              pattern
     |           |           |           |           |
     +-----------+-----------+-----------+-----------+
                              |
                              v
                    +-------------------+
                    | Confidence        |
                    | Aggregator        |
                    +-------------------+
                              |
                              v
                    +-------------------+
                    | Finding Composer  |
                    +-------------------+
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
   IDE / Web panel      MCP tools           CI / PR gate
         |                    |                    |
         v                    v                    v
 Architecture fact     Agent-callable      Audit summary
 review queue          verify_diff         + block/ack
 Doc suggestions
```

---

## 3. System Surfaces vs Engine

| Layer | Responsibility |
|-------|----------------|
| **Verification engine** | Index, retrieve, orchestrate agents, score, compose findings, persist review state |
| **Runner / triggers** | `watch-save.py`, post-commit hook, CI script — invoke engine on events |
| **MCP server** | Thin wrapper exposing tools to Cursor / Claude Code |
| **Frontend / extension** | Assurance dashboard: findings, timeline, citations, fact queue |
| **CI action** | `POST /api/verify` on PR diff; fail or comment on severity threshold |

MCP alone cannot provide background verification — something must call the engine on each event.

---

## 4. Core Components

### 4.1 Trigger Router

Maps `trigger` + `changed_paths` to verification scope and active agents.

```python
TRIGGER_CONFIG = {
    "save":       {"max_files": 5,  "agents": "core"},      # 5 micro-verifiers
    "commit":     {"max_files": 20, "agents": "core_plus"},
    "pr":         {"max_files": None, "agents": "full"},
    "test_failure": {"agents": "rca_swarm"},
    "fact_confirm": {"agents": "targeted_reverify"},
}
```

**Scope rules:**

- `save` — changed file + 1-hop import neighbors from graph
- `commit` / `pr` — union of diff paths + `affected_paths()` from indexer
- `test_failure` — failing test file + imports + related corpus only

---

### 4.2 Repo Indexer (deterministic)

**No LLM.** Parses the demo monorepo and builds a dependency graph.

Responsibilities:

- Discover packages/services (`apps/web`, `apps/api`, `packages/payments`, etc.)
- Parse Python imports (MVP); stub interfaces for other languages
- Emit nodes, edges, and `blast_radius[path] -> [dependent paths]`
- Produce unified diff summary for `base_ref` / `head_ref` (via `git diff`)

Output contract — `RepoGraph`:

```json
{
  "nodes": [
    {"id": "apps/web", "type": "service", "label": "web"},
    {"id": "packages/payments", "type": "service", "label": "payments"}
  ],
  "edges": [
    {"from": "apps/web/checkout.py", "to": "packages/payments/client.py", "kind": "import"}
  ],
  "affected_paths": ["apps/web/checkout.py", "packages/payments/client.py"]
}
```

Files: `backend/indexer/loader.py`, `graph.py`, `diff.py`

---

### 4.3 Engineering Corpus Store

Local markdown knowledge base with embedded citation IDs.

```txt
data/
├── engineering_corpus/
│   ├── adrs/
│   │   └── ARCH_ADR_004_service_boundaries.md
│   ├── incidents/
│   │   └── INCIDENT_PM_2024_03_payments_bypass.md
│   ├── policies/
│   │   ├── data_handling_policy.md
│   │   └── vendor_risk_policy.md
│   └── CONTRIBUTING.md
└── demo_repo/
    ├── apps/web/checkout.py
    ├── apps/api/...
    └── packages/payments/...
```

Citation header convention:

```md
## ARCH_ADR_004: Service Boundary Rules

The web application must not import from the payments package directly.
All payment operations must go through the API gateway service.
```

---

### 4.4 Corpus Retriever

Retrieval query is built from **change context**, not a user question:

```txt
{changed_file_paths} + {diff_summary} + {graph_neighborhood_labels}
```

MVP options: Chroma, FAISS, in-memory vectors, keyword fallback.

Output — `CorpusChunk`:

```json
{
  "citation_id": "ARCH_ADR_004",
  "document_title": "Service Boundary Rules",
  "section_title": "Web to Payments",
  "text": "The web application must not import from the payments package directly.",
  "score": 0.91
}
```

Files: `backend/retrieval/loader.py`, `chunker.py`, `retriever.py`

---

### 4.5 Cerebras Client

Shared async LLM client for all agents.

```python
async def complete_json(
    prompt: str,
    *,
    model: str = "gemma-4-31b",
    timeout_s: float = 15.0,
) -> tuple[dict, int]:  # (parsed_json, latency_ms)
    ...
```

Requirements:

- JSON-only responses; parse with repair fallback
- Per-call latency returned for agent timeline
- Errors bubble as `AgentError(agent_name, message)` — orchestrator catches per agent

Env: `CEREBRAS_API_KEY`, `CEREBRAS_BASE_URL` (optional)

---

### 4.6 Verification Orchestrator

Central pipeline invoked by API and MCP.

```python
async def run_verification(req: VerifyRequest) -> VerificationRun:
    t0 = time.monotonic()
    graph = build_graph(req.repo_path, req.changed_paths, req.base_ref, req.head_ref)
    chunks = retrieve_corpus(graph, req.diff_summary)
    confirmed_facts = review_store.get_confirmed_facts()

    agent_results = await asyncio.gather(
        run_architecture_boundary_agent(graph, chunks, confirmed_facts),
        run_convention_agent(req.diff_summary, chunks),
        run_doc_drift_agent(req.diff_summary, chunks),
        run_incident_pattern_agent(req.diff_summary, chunks),
        run_risk_agent(req.diff_summary, chunks),
        return_exceptions=True,
    )

    findings = compose_findings(agent_results, chunks)
    score_confidence(findings, agent_results)
    gaps, suggestions = detect_gaps_and_suggestions(findings, agent_results)
    proposed_facts = extract_proposed_facts(graph, agent_results)  # Sprint 4+

    return VerificationRun(...)
```

**Critical:** `return_exceptions=True` — one failed agent must not kill the run.

Files: `backend/pipeline/orchestrator.py`

---

### 4.7 Parallel Micro-Verifiers

All agents share a common input bundle:

```json
{
  "trigger": "save",
  "diff_summary": "...",
  "changed_paths": ["apps/web/checkout.py"],
  "graph_excerpt": { "...": "..." },
  "corpus_chunks": [],
  "confirmed_architecture_facts": []
}
```

Each agent returns `AgentResult`:

```json
{
  "agent": "architecture_boundary",
  "status": "ok",
  "latency_ms": 142,
  "findings": [],
  "raw": {}
}
```

On failure: `"status": "error"`, `"error": "timeout"`, `"findings": []`.

---

#### Agent 1: Architecture Boundary

Checks code changes against confirmed facts + ADR boundary rules.

Prompt skeleton:

```txt
You are an architecture boundary verifier for an enterprise monorepo.

Rules:
- Use only the provided diff, graph excerpt, corpus chunks, and confirmed facts.
- Flag cross-service imports that violate ADRs or confirmed boundaries.
- Cite citation_ids from corpus chunks as evidence.
- Return JSON only.

Diff:
{diff_summary}

Graph excerpt:
{graph_excerpt}

Confirmed architecture facts:
{confirmed_facts}

Corpus:
{corpus_chunks}

Return JSON:
{
  "findings": [
    {
      "severity": "high",
      "title": "Direct web → payments import",
      "explanation": "...",
      "citation_ids": ["ARCH_ADR_004", "INCIDENT_PM_2024_03"],
      "related_paths": ["apps/web/checkout.py"],
      "recommended_fix": "Route through apps/api gateway client."
    }
  ]
}
```

File: `backend/agents/architecture_boundary_agent.py`

---

#### Agent 2: Convention

Checks diff against `CONTRIBUTING.md` and convention corpus chunks.

File: `backend/agents/convention_agent.py`

---

#### Agent 3: Doc Drift

Checks whether the change contradicts ADR/README claims in retrieved chunks.

File: `backend/agents/doc_drift_agent.py`

---

#### Agent 4: Incident Pattern

Matches change patterns against postmortem anti-patterns in corpus.

File: `backend/agents/incident_pattern_agent.py`

---

#### Agent 5: Risk

Classifies compliance/security/privacy risk for the change.

Output includes `risk_level`: `low` | `medium` | `high`.

File: `backend/agents/risk_agent.py`

---

#### Stretch Agent: Skeptic

Adversarial pass — missing error handling, hidden assumptions.

File: `backend/agents/skeptic_agent.py`

---

#### Stretch: Test-Failure RCA Swarm

Only on `trigger: test_failure`. Runs parallel **hypothesis** verifiers:

```python
await asyncio.gather(
    verify_hypothesis("implementation_bug", ...),
    verify_hypothesis("flaky_test", ...),
    verify_hypothesis("stale_docs", ...),
    verify_hypothesis("config_env", ...),
)
```

Returns ranked hypotheses with evidence — not a single monolithic RCA prompt.

File: `backend/agents/rca_swarm.py`

---

### 4.8 Architecture Map Service

Three layers:

```txt
Deterministic graph (indexer)
        →
LLM fact proposer (labels boundaries, allowed paths)
        →
Human review (confirm | reject | edit)
        →
Confirmed facts stored in review_store
        →
Fed into architecture_boundary agent on future runs
```

`ArchitectureFact` lifecycle: `proposed` → `confirmed` | `rejected`

On `confirmed`, trigger `fact_confirm` re-verification for `fact.affected_paths`.

Files: `backend/architecture/fact_proposer.py`, `backend/improvement/review_store.py`

---

### 4.9 Confidence Aggregator

Deterministic scoring per finding and optional run-level summary.

```python
def score_finding(base: int, finding: dict, agent_outputs: list) -> int:
    score = base  # default 100
    severity = finding.get("severity")
    if severity == "high":
        score -= 25
    elif severity == "medium":
        score -= 12
    elif severity == "low":
        score -= 5

    if not finding.get("citation_ids"):
        score -= 15

  # Cap if any agent failed
    if agent_outputs.incomplete:
        score = min(score, 70)

    return max(0, min(100, score))
```

**Never** ask the LLM for a confidence number.

File: `backend/scoring/confidence.py`

---

### 4.10 Finding Composer

- Dedupe findings by `(title, related_paths)` similarity
- Merge citation IDs from multiple agents
- Attach corpus snippet text for each citation ID
- Sort by severity, then descending confidence
- Set `verification_incomplete` on run if any agent errored

File: `backend/pipeline/composer.py`

---

### 4.11 Gap Detection + Doc Suggestions

Consumes composed findings (same pattern as original TrustLoop improvement layer).

- `gap_detector.py` — map finding types → `DocumentGap`
- `suggestion_generator.py` — 1–3 `SuggestedDocumentUpdate` per run max for MVP
- Never write to corpus files automatically

---

### 4.12 Review Store

Local JSON or SQLite for MVP:

- `architecture_facts` — proposed / confirmed / rejected
- `finding_acknowledgments` — for PR gate override demo
- `suggested_document_updates` — pending / approved / rejected
- `verification_runs` — audit trail (optional append-only log)

File: `backend/improvement/review_store.py`

---

## 5. Backend API

Stack: **Python 3.11+**, **FastAPI**, **uvicorn**

### Primary endpoint

```txt
POST /api/verify
```

Request:

```json
{
  "repo_path": ".",
  "base_ref": "main",
  "head_ref": "HEAD",
  "changed_paths": ["apps/web/checkout.py"],
  "trigger": "save",
  "diff_summary": "optional precomputed diff text",
  "test_context": null
}
```

Response: `VerificationRun` (see §7.2)

### Additional endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/findings?run_id=` | Latest or specific run findings |
| `GET` | `/api/architecture/facts` | List proposed + confirmed facts |
| `POST` | `/api/architecture/facts/{id}/review` | Confirm / reject / edit fact |
| `POST` | `/api/verify/test-failure` | RCA swarm demo |
| `POST` | `/api/suggestions/{id}/review` | Approve / reject doc suggestion |
| `GET` | `/health` | Liveness |

### Optional stretch — Policy Q&A

```txt
POST /api/ask
```

Legacy answer + claim verification flow over corpus only (no code diff). Reuses retriever, Cerebras client, confidence aggregator. Build after core verify path is stable.

---

## 6. MCP Server

Thin FastMCP (or equivalent) wrapper calling the same orchestrator.

| Tool | Input | Output |
|------|-------|--------|
| `verify_diff` | `base`, `head`, `paths?` | `VerificationRun` |
| `verify_file` | `path` | `VerificationRun` |
| `get_findings` | `severity?`, `status?` | `Finding[]` |
| `get_architecture_map` | `scope?` | `RepoGraph` + facts |
| `confirm_architecture_fact` | `fact_id`, `decision`, `edited_text?` | updated fact |
| `search_engineering_corpus` | `query` | `CorpusChunk[]` |

File: `backend/mcp/server.py`

---

## 7. Data Contracts

Contracts are the **integration boundary** for parallel development. Implement as Pydantic models in `backend/models/` and mirror as TypeScript types in `frontend/src/types/`. Ship JSON fixtures in `fixtures/` for UI work before the pipeline is wired.

### 7.1 Finding

```json
{
  "id": "finding_1",
  "severity": "high",
  "confidence": 82,
  "title": "Direct web → payments import",
  "explanation": "checkout.py imports payments.client; ADR-004 forbids direct web access to payments.",
  "citation_ids": ["ARCH_ADR_004", "INCIDENT_PM_2024_03"],
  "evidence_snippets": [
    {
      "citation_id": "ARCH_ADR_004",
      "text": "The web application must not import from the payments package directly."
    }
  ],
  "related_paths": ["apps/web/checkout.py"],
  "recommended_fix": "Use apps/api/payments_gateway client instead.",
  "detected_by": ["architecture_boundary", "incident_pattern"],
  "status": "open"
}
```

Severity: `low` | `medium` | `high`  
Status: `open` | `acknowledged` | `dismissed`

---

### 7.2 VerificationRun

```json
{
  "id": "run_abc123",
  "trigger": "save",
  "repo_path": ".",
  "base_ref": "main",
  "head_ref": "HEAD",
  "changed_paths": ["apps/web/checkout.py"],
  "findings": [],
  "risk_level": "medium",
  "overall_confidence": 78,
  "verification_incomplete": false,
  "agent_timeline": [
    {"agent": "architecture_boundary", "status": "ok", "latency_ms": 138},
    {"agent": "convention", "status": "ok", "latency_ms": 121},
    {"agent": "doc_drift", "status": "ok", "latency_ms": 156},
    {"agent": "incident_pattern", "status": "ok", "latency_ms": 144},
    {"agent": "risk", "status": "ok", "latency_ms": 119}
  ],
  "architecture_facts_proposed": [],
  "document_gaps": [],
  "suggested_document_updates": [],
  "latency": {
    "indexing_ms": 35,
    "retrieval_ms": 48,
    "parallel_verification_ms": 156,
    "composition_ms": 12,
    "total_ms": 312
  },
  "metadata": {
    "files_checked": 3,
    "citations_consulted": 6,
    "agents_run": 5
  }
}
```

Note: `parallel_verification_ms` = wall-clock time for `asyncio.gather()`, not sum of agents.

---

### 7.3 ArchitectureFact

```json
{
  "id": "fact_1",
  "status": "proposed",
  "statement": "apps/web must not import packages/payments",
  "allowed_paths": ["apps/web → apps/api → packages/payments"],
  "source_citation_ids": ["ARCH_ADR_004"],
  "affected_paths": ["apps/web/", "packages/payments/"],
  "proposed_by": "fact_proposer",
  "reviewed_by": null,
  "reviewed_at": null
}
```

---

### 7.4 CorpusChunk

```json
{
  "citation_id": "ARCH_ADR_004",
  "document_title": "Service Boundary Rules",
  "section_title": "Web to Payments",
  "text": "...",
  "score": 0.91
}
```

---

### 7.5 DocumentGap

```json
{
  "id": "gap_1",
  "type": "doc_drift",
  "severity": "medium",
  "related_finding_id": "finding_2",
  "source_citations": ["ARCH_ADR_004"],
  "description": "README for web claims direct payment retries are allowed; ADR-004 forbids direct payments access.",
  "detected_by": ["doc_drift"],
  "confidence": 0.81
}
```

Gap types: `boundary_violation` | `doc_drift` | `convention` | `incident_pattern` | `missing_coverage` | `ambiguous_source`

---

### 7.6 SuggestedDocumentUpdate

```json
{
  "id": "suggestion_1",
  "gap_id": "gap_1",
  "target_document": "apps/web/README.md",
  "target_section": "Payments integration",
  "suggested_text": "Web must call payments only via API gateway; see ARCH_ADR_004.",
  "reason": "Doc drift finding on checkout change.",
  "status": "pending_review",
  "priority": "medium",
  "created_from_run_id": "run_abc123"
}
```

---

### 7.7 HumanReviewDecision

```json
{
  "id": "review_1",
  "target_type": "suggested_document_update",
  "target_id": "suggestion_1",
  "decision": "approved",
  "reviewer": "platform_lead_demo",
  "reviewed_at": "2026-06-28T15:30:00Z",
  "review_notes": "Approved for demo corpus.",
  "approved_text": "..."
}
```

---

### 7.8 AgentResult (internal)

```json
{
  "agent": "architecture_boundary",
  "status": "ok",
  "latency_ms": 142,
  "findings": [],
  "error": null
}
```

---

## 8. UI Architecture

Assurance dashboard — **not** a chat UI.

```txt
 -----------------------------------------------------------------
| TrustLoop — Ambient Code Assurance                              |
 -----------------------------------------------------------------
| [Verify branch]  apps/web/checkout.py  trigger: save            |
 -----------------------------------------------------------------
| FINDINGS (2)                    | AGENT TIMELINE (parallel)     |
| HIGH  Boundary violation  82%   | architecture_boundary  138ms |
| MED   Doc drift hint      71%   | convention             121ms |
|                                 | doc_drift              156ms |
|                                 | incident_pattern       144ms |
|                                 | risk                   119ms |
 -----------------------------------------------------------------
| CITATION EVIDENCE                                               |
| ARCH_ADR_004 — web must not import payments directly            |
| INCIDENT_PM_2024_03 — outage from boundary bypass               |
 -----------------------------------------------------------------
| ARCHITECTURE FACTS (1 proposed)                                 |
| [Confirm] [Reject]  web → payments direct import forbidden      |
 -----------------------------------------------------------------
| DOC IMPROVEMENT SUGGESTIONS                                     |
| Update web README payments section — pending review               |
 -----------------------------------------------------------------
| LATENCY  5 agents | 3 files | 6 citations | 312ms total       |
 -----------------------------------------------------------------
```

Stack: Next.js, React, Tailwind, shadcn/ui. Streamlit acceptable for fastest MVP.

Key views:

- `FindingsPanel` — severity, confidence, fix, ack button
- `AgentTimeline` — parallel bars, error state per agent
- `CitationViewer` — chunk text by citation ID
- `ArchitectureFactQueue` — propose / confirm flow
- `SuggestionsPanel` — approve / reject
- `DiffContext` — changed files + mini graph neighborhood

---

## 9. Triggers and Runners

| Runner | File | Behavior |
|--------|------|----------|
| Save watcher | `scripts/watch-save.py` | Debounce 500ms → `POST /api/verify` `trigger=save` |
| Post-commit | `scripts/post-commit-verify.sh` | Async `trigger=commit` |
| PR verify | `scripts/verify-pr.sh` | `trigger=pr`; exit 1 on unacknowledged high findings |
| Manual | UI / MCP | `trigger=manual` |

---

## 10. Recommended Folder Structure

```txt
trustloop/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── DEMO_SCRIPT.md
├── fixtures/
│   ├── verification_run_violation.json
│   ├── verification_run_clean.json
│   └── architecture_facts.json
├── frontend/
│   └── src/
│       ├── types/
│       └── components/
├── backend/
│   ├── app.py
│   ├── models/
│   │   ├── finding.py
│   │   ├── verification.py
│   │   └── architecture.py
│   ├── pipeline/
│   │   ├── orchestrator.py
│   │   └── composer.py
│   ├── agents/
│   │   ├── architecture_boundary_agent.py
│   │   ├── convention_agent.py
│   │   ├── doc_drift_agent.py
│   │   ├── incident_pattern_agent.py
│   │   ├── risk_agent.py
│   │   ├── skeptic_agent.py
│   │   └── rca_swarm.py
│   ├── indexer/
│   │   ├── loader.py
│   │   ├── graph.py
│   │   └── diff.py
│   ├── retrieval/
│   │   ├── loader.py
│   │   ├── chunker.py
│   │   └── retriever.py
│   ├── architecture/
│   │   └── fact_proposer.py
│   ├── scoring/
│   │   └── confidence.py
│   ├── improvement/
│   │   ├── gap_detector.py
│   │   ├── suggestion_generator.py
│   │   └── review_store.py
│   ├── llm/
│   │   └── cerebras_client.py
│   └── mcp/
│       └── server.py
├── data/
│   ├── engineering_corpus/
│   └── demo_repo/
└── scripts/
    ├── watch-save.py
    ├── post-commit-verify.sh
    └── verify-pr.sh
```

---

## 11. Parallel Development Plan (2 people)

See `docs/PRD.md` §17 for phases. Summary:

| Phase | Goal |
|-------|------|
| **0** | Fixtures + mock API + UI shell + demo data |
| **1** | MVP: 3 agents, indexer, retriever, real `/api/verify`, Verify button |
| **2** | Demo harden + `DEMO_SCRIPT.md` |
| **3+** | Add-ons A1–A9 in priority order |

### Ownership

| Person A — Engine | Person B — Surface |
|-------------------|-------------------|
| `backend/models/`, `indexer/`, `retrieval/`, `agents/` (MVP: 3), `pipeline/`, `llm/`, `app.py` | `frontend/`, `data/demo_repo/`, `data/engineering_corpus/`, `fixtures/`, `DEMO_SCRIPT.md` |
| Add-ons: `mcp/`, `architecture/`, `improvement/`, `scripts/` | Add-on UI panels |

### MVP agent set (3 only)

1. `architecture_boundary_agent.py`
2. `incident_pattern_agent.py`
3. `risk_agent.py`

Add-on A2 adds `convention_agent.py`, `doc_drift_agent.py`.

### Integration order

1. Fixture → UI (Phase 0, no backend logic needed)
2. Indexer + retriever → API returns scope + chunks (optional debug view)
3. 3 agents + orchestrator → live findings
4. Freeze MVP demo before any add-on branch

---

## 12. Mock Mode

When `CEREBRAS_API_KEY` is unset or `TRUSTLOOP_MOCK=1`:

- Load canned `AgentResult` payloads from `fixtures/`
- Still run indexer + retriever for real
- UI and MCP function for demos without API access

---

## 13. Appendix: Policy Q&A Mode (optional)

Separate flow for natural-language questions over the engineering corpus (no code diff). Reuses retriever + parallel claim verifiers from the original TrustLoop design.

```txt
question → retrieve → answer agent → claim extractor
  → [parallel claim verifiers] → confidence → composed answer
```

Endpoints: `POST /api/ask`. Models: `Claim`, claim-level statuses. Build only after `POST /api/verify` is stable, or as an isolated stretch track.

Claim object (Q&A mode only):

```json
{
  "id": "claim_1",
  "text": "The analytics vendor must be approved by Vendor Risk.",
  "status": "supported",
  "confidence": 0.94,
  "supporting_citations": ["VENDOR_POLICY_1.4"],
  "citation_strength": "strong",
  "suggested_correction": null
}
```

---

## 14. Related Documents

- `docs/PRD.md` — requirements, triggers, MVP scope, sprint plan
- `docs/DEMO_SCRIPT.md` — judge demo script (Sprint 5)
- `CLAUDE.md` — implementation guardrails
