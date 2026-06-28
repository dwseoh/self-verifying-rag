# TrustLoop PRD

## Ambient Code Assurance Powered by Parallel Inference

## 1. Product Summary

TrustLoop is an **ambient code assurance layer** for engineering teams. It continuously verifies code changes against architecture rules, engineering conventions, internal documentation, and past incidents — and surfaces evidence-backed findings before bad patterns ship.

Unlike enterprise knowledge MCPs that **retrieve** information on demand, TrustLoop **acts**: it runs many small verifier agents in parallel on every meaningful code event, scores confidence deterministically, and returns citations to the source material that triggered each finding.

The core technical insight is not only that verification can run in parallel — it is that **Cerebras ultra-fast Gemma inference makes verification frequent enough to feel live**. TrustLoop can run 8–15 micro-verifier calls per change in under a second, enabling a product closer to semantic spell-check than a nightly audit bot.

TrustLoop is not a chatbot over your wiki. It is a **real-time immune system for code and engineering knowledge**.

### What the user receives

- Inline findings on code changes (boundary violations, convention breaks, doc drift, incident-pattern matches)
- Evidence snippets with citation IDs from policies, ADRs, runbooks, and postmortems
- Per-finding confidence and severity
- A human-confirmed architecture map that improves verification quality over time
- Optional test-failure RCA swarm (parallel hypotheses ranked with evidence)
- Audit trail per change (commit, PR, or manual verify)
- Latency metrics showing parallel agent fan-out

---

## 2. Problem

Enterprise engineering teams already have:

- Internal knowledge bases (Confluence, Notion, ADRs)
- Coding standards and review checklists
- Incident postmortems and “never again” lessons
- Architecture diagrams that drift from implementation
- Knowledge MCPs that answer questions when asked

What they do **not** have is a system that **consistently verifies code against that knowledge** as developers work.

### Failure modes today

| Approach | Limitation |
|----------|------------|
| Knowledge MCP / RAG chat | Retrieves docs; does not verify the current diff |
| Static lint / formatters | Fast, but cannot reason about architecture intent or policy |
| PR-only LLM review | Too slow and too late; often one shallow pass |
| Manual architecture reviews | Do not scale; docs go stale immediately |

### Example

A developer adds a cross-service import in a monorepo:

```python
from payments.client import charge_customer  # UI layer calling payments directly
```

A knowledge MCP might retrieve the architecture doc stating UI must not call payments directly — **if someone asks**.

TrustLoop should surface within a second:

> **Boundary violation (high)** — `ADR-004` and `postmortem-2024-03` require UI → API gateway → payments. Citation: `ARCH_ADR_004`, `INCIDENT_PM_2024_03`. Confidence: 82.

---

## 3. Why Cerebras Changes the Product

Slow inference forces batch verification (PR time, scheduled scans). Fast inference enables **frequency × parallelism**.

### Two unlocks

1. **Parallelism** — Run factual, convention, architecture, doc-drift, incident-pattern, and risk micro-verifiers concurrently.
2. **Frequency** — Run scoped verification on debounced save, test failure, commit, and PR — not just one event type.

### Product shift

| Slow-inference product | Cerebras-native product |
|------------------------|-------------------------|
| Verify on PR | Verify on **save + commit + PR** |
| 5 heavy agents | **8–15 micro-verifiers** per scoped change |
| Background batch job | **Always-on shadow layer** |
| One interpretation | **Speculative hypotheses** checked in parallel |
| “Audit tool” | **Ambient assurance** |

### Hackathon pitch line

> Cerebras does not just make code review faster. It makes **continuous engineering verification** usable.

---

## 4. Target Users

### Primary users

- Platform / developer experience engineers
- Staff engineers and tech leads
- Security and application security engineers
- Engineering managers responsible for architecture quality
- Teams in regulated environments (fintech, health, infra)

### Primary hackathon persona

**Platform engineer at Northstar Bank (fictional fintech)**

Maintains a payments monorepo with strict service boundaries, data-handling policies, and incident history. Needs violations caught **while coding**, not only at PR review.

### Secondary persona

**Compliance-adjacent engineer** verifying that implementation matches data-handling and vendor policies embedded in the engineering corpus.

---

## 5. Product Vision

TrustLoop becomes the **verification layer between code changes and engineering knowledge**.

Long term:

- IDE extension for live diagnostics
- MCP tools for coding agents (Cursor, Claude Code)
- CI / PR gates with audit export
- Human-confirmed architecture graph as shared truth
- Approved updates to ADRs/runbooks when verification finds doc drift

TrustLoop does **not** auto-edit source docs or code. It proposes findings and documentation improvements; humans approve.

---

## 6. Trigger Model

Verification depth scales by event. Full multi-agent RAG must **not** run identically on every event — scope and agent count vary.

| Event | Scope | Agents | Blocking? |
|-------|-------|--------|-----------|
| Debounced save | Touched file + immediate dependencies | 6–10 micro-verifiers | No — inline advisory |
| Test failure | Failing test + related files | RCA swarm (4–6 hypotheses) | No |
| Commit (post-commit hook) | Commit diff + affected subgraph | 8–12 micro-verifiers | No — async queue |
| PR open / update | Branch diff vs base | Full verification pass | Yes — configurable gate |
| Human confirms architecture fact | Affected subgraph refresh | Targeted re-verify | No |
| Nightly (stretch) | Full repo | Deep doc-drift + map refresh | No |

### Implementation note

Post-commit async is the default “always on” path when no IDE is connected. Live save verification is the **hero demo** path when an extension or local daemon is present.

---

## 7. System Surfaces

TrustLoop is one **verification engine** with multiple surfaces. Do not conflate them.

```txt
┌─────────────────────────────────────────────────────────┐
│ Surfaces                                                │
│  • IDE extension / local panel (primary UX)             │
│  • MCP server (agent-callable tools)                    │
│  • CI action / PR comment bot (team policy)             │
│  • Web dashboard (review queue, architecture map)       │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Verification engine                                     │
│  • Repo indexer (deterministic graph)                   │
│  • RAG retriever (policies, ADRs, postmortems)          │
│  • Parallel micro-verifiers (Gemma on Cerebras)         │
│  • Deterministic confidence aggregator                  │
│  • Finding composer + review store                      │
└─────────────────────────────────────────────────────────┘
```

### MCP role

MCP is an **integration layer**, not the whole product. Expose tools such as:

- `verify_diff(base, head, paths?)`
- `verify_file(path)`
- `get_findings(severity?, status?)`
- `get_architecture_map(scope?)`
- `confirm_architecture_fact(fact_id, approved, edited_text?)`
- `search_engineering_corpus(query)`

Background verification requires a **runner** (daemon, git hook, or CI) that invokes the engine; MCP alone is pull-oriented.

### Extension role

Primary developer UX: inline diagnostics, finding details with citations, “confirm fact” actions, manual “verify branch” trigger.

---

## 8. Human-in-the-Loop Architecture Map

LLM-generated architecture diagrams hallucinate. TrustLoop uses a **confirmed graph**:

1. **Deterministic layer** — imports, packages, services, APIs, config (no LLM).
2. **LLM labeling layer** — proposes boundaries, ownership, allowed call paths.
3. **Human confirmation** — reviewer approves/edits facts; stored as verified truth.
4. **Fast re-verification** — on fact confirm or related code change, re-check affected subgraph using Cerebras speed.

Architecture facts are first-class objects with `status: proposed | confirmed | rejected`.

---

## 9. User Stories

### US-1: Live boundary warning

As a developer, I want boundary violations surfaced while I edit so I do not discover them days later in PR review.

**Acceptance criteria:**

- Debounced save triggers scoped verification in &lt; 2s (target &lt; 1s with warm cache).
- Finding includes severity, explanation, and citation IDs.
- Finding links to relevant source doc snippet.

---

### US-2: Convention and style contract checks

As a tech lead, I want convention rules from `CONTRIBUTING.md` and internal guides enforced semantically, not only by regex.

**Acceptance criteria:**

- Convention verifier runs in parallel with other micro-verifiers.
- Weak/ambiguous convention findings are marked uncertain, not high confidence.

---

### US-3: Doc drift detection

As a staff engineer, I want to know when code contradicts ADRs or README claims.

**Acceptance criteria:**

- Doc-drift verifier compares change summary against retrieved ADR/README chunks.
- Contradictions cite both code context and doc citation ID.

---

### US-4: Past incident pattern match

As a platform engineer, I want new code flagged when it resembles patterns from postmortems.

**Acceptance criteria:**

- Incident corpus is searchable via RAG.
- Matches include incident ID, pattern description, and recommended fix.

---

### US-5: Test failure RCA swarm

As a developer, when tests fail I want parallel hypotheses (bug vs flaky test vs doc stale vs config) ranked with evidence.

**Acceptance criteria:**

- Triggered manually or via test-runner hook in demo.
- At least 4 hypotheses checked in parallel.
- Results returned in one aggregated response with timings.

---

### US-6: PR verification gate

As an engineering manager, I want high-severity findings to block merge or require explicit acknowledgment.

**Acceptance criteria:**

- CI action calls `POST /api/verify` with base/head SHAs.
- PR summary lists findings, confidence, citations, agent count, total latency.
- Configurable fail threshold (e.g. any `high` unacknowledged finding).

---

### US-7: Confirm architecture facts

As a tech lead, I want to approve or correct proposed architecture boundaries so future checks use trusted facts.

**Acceptance criteria:**

- UI/MCP exposes pending proposed facts.
- Confirming a fact triggers targeted re-verification of dependent files.
- Confirmed facts appear in audit trail.

---

### US-8: MCP tools for coding agents

As a developer using Cursor, I want the coding agent to call verification tools before suggesting risky changes.

**Acceptance criteria:**

- MCP server exposes `verify_diff` and `get_findings`.
- Tool responses use stable JSON contracts (see Architecture doc).

---

### US-9: Speed and parallelism visible

As a judge or evaluator, I want to see parallel micro-agents completing in sub-second wall time.

**Acceptance criteria:**

- UI shows per-agent latency, total fan-out time, agents run, files checked.
- Demo highlights live save verification, not only PR batch mode.

---

### US-10: Suggested engineering doc updates

As a knowledge owner, I want verification gaps turned into suggested ADR/runbook updates for human review.

**Acceptance criteria:**

- Gaps derived from verifier outputs (unsupported assumption, ambiguous ADR, missing exception).
- Suggestions have `status: pending_review | approved | rejected`.
- No automatic writes to corpus files.

---

## 10. Functional Requirements

### F1. Demo repository and engineering corpus

**Repository:** Small fictional Northstar Bank monorepo (2–4 services/packages) with at least one intentional boundary violation path for demo.

**Corpus** (`data/engineering_corpus/`):

- Architecture ADRs with citation IDs (e.g. `ARCH_ADR_004`)
- Data handling / vendor policies (optional overlap with original policy demo)
- `CONTRIBUTING.md` and convention docs
- At least one postmortem (e.g. `INCIDENT_PM_2024_03`)
- Service README files with explicit claims verifiable against code

Citation ID convention matches policy sections: `ARCH_ADR_004`, `DATA_POLICY_3.2`, etc.

---

### F2. Deterministic repo indexer

- Build import/call graph for demo monorepo.
- Identify package/service boundaries and changed-file blast radius.
- Output stable JSON: nodes, edges, `affected_by_change[path]`.
- No LLM required for graph construction.

---

### F3. Engineering corpus retrieval

- Chunk and index markdown corpus.
- Return chunks with: `citation_id`, `document_title`, `section_title`, `text`, `score`.
- Keyword fallback acceptable for MVP.

---

### F4. Verification API

Primary endpoint:

```txt
POST /api/verify
```

Request (example):

```json
{
  "repo_path": "/path/to/repo",
  "base_ref": "main",
  "head_ref": "HEAD",
  "changed_paths": ["apps/web/checkout.py"],
  "trigger": "save",
  "include_test_context": false
}
```

Response (example):

```json
{
  "findings": [],
  "architecture_facts_pending": [],
  "suggested_doc_updates": [],
  "latency": {
    "indexing_ms": 40,
    "retrieval_ms": 60,
    "parallel_verification_ms": 520,
    "total_ms": 780,
    "agents_run": 8
  },
  "metadata": {
    "trigger": "save",
    "files_checked": 3,
    "citations_consulted": 7
  }
}
```

Secondary endpoints (MVP or Sprint 4+):

- `GET /api/findings`
- `POST /api/architecture/facts/{id}/review`
- `POST /api/verify/test-failure` (RCA swarm)

---

### F5. Parallel micro-verifiers (Gemma on Cerebras)

All verifiers for a given request run via `asyncio.gather()` (or equivalent). **Serial verifier execution is out of scope.**

**MVP agents (3):**

| Agent | Purpose |
|-------|---------|
| **Architecture boundary** | Cross-service / layer violations vs ADRs |
| **Incident pattern** | Postmortem anti-pattern match |
| **Risk** | Security, privacy, compliance sensitivity |

**Add-on A2 (+2 agents):** Convention, Doc drift.

**Add-on A7:** RCA swarm on test failure. **Stretch:** Skeptic, test adequacy.

Each agent returns structured JSON with: `finding_id`, `severity`, `confidence`, `citation_ids[]`, `explanation`, `recommended_fix`, `related_paths[]`.

---

### F6. Deterministic confidence aggregation

Overall and per-finding confidence computed by fixed penalty rules — **not** by asking the LLM for a score. See `docs/ARCHITECTURE.md` for formula pattern.

Incomplete verification (agent failure) must cap confidence and flag `verification_incomplete: true`.

---

### F7. Finding composer

Merge micro-verifier outputs into deduplicated findings ranked by severity and confidence. Attach evidence snippets from corpus retrieval.

---

### F8. Gap detection and suggested doc updates (Add-on A4)

Convert verification gaps into `DocumentGap` and `SuggestedDocumentUpdate` objects. Not MVP.

---

### F9. Human review store (Add-on A5)

Local JSON or sqlite — required for architecture-fact confirm flow and PR ack overrides. Not MVP.

---

### F10. MCP server (Add-on A3)

Thin wrapper over verification API. Not MVP.

---

### F11. Developer UI (MVP)

**MVP minimum:**

- **Verify** button (manual trigger)
- Findings list with severity badges
- Citation snippets
- Agent timeline + latency panel

**Add-on UI:** save auto-refresh (A1), architecture fact queue (A5), doc suggestions (A4), RCA button (A7).

UI should read as an **assurance dashboard**, not a chat thread.

---

### F12. CI integration (Add-on)

GitHub Action (or script) invoking verify API on PR diff; post summary comment. Configurable severity threshold. Not required for MVP.

---

## 11. Non-Functional Requirements

### Performance

- Scoped save verification: target &lt; 2s end-to-end; stretch &lt; 1s.
- PR verification: target &lt; 5s on demo repo.
- All micro-verifiers for a request run in parallel.

### Reliability

- Single agent failure → partial results; never silent success.
- Errors surfaced per agent in timeline.

### Security (MVP)

- API keys in environment variables only.
- Demo repo and corpus are fictional; no real customer data.

### Explainability

Every finding must cite **why** and link to corpus citation IDs where applicable.

### Auditability

Per verification run, persist: trigger, diff scope, retrieved chunks, agent outputs, final findings, latency.

---

## 12. Risks and Scope Controls

| Risk | Control |
|------|---------|
| Scope creep into full static analysis | Deterministic graph + LLM verifiers only; no whole-program symbolic execution |
| Noisy save-triggered warnings | Debounce, blast-radius scoping, severity tiers, acknowledge flow |
| Architecture map hallucination | Human confirmation required before fact affects gating |
| MCP mistaken as full product | Document runner + engine as core; MCP as one surface |
| Cerebras API unavailable | Graceful degradation; mock verifier fixtures for frontend |

---

## 13. MVP vs Add-ons

Built by **2 people**. Ship a working demo first; everything else is a prioritized add-on stack.

### MVP — must ship (demo-able)

The smallest path to the hero moment: *bad import → manual verify → finding with citations in &lt; 2s*.

| Area | MVP scope |
|------|-----------|
| **Data** | `demo_repo/` (web, api, payments) + minimal corpus: 1 ADR, 1 postmortem, `CONTRIBUTING.md` — all with citation IDs |
| **Indexer** | Python import graph + `affected_paths` for changed file (deterministic) |
| **Retriever** | Keyword search over corpus chunks (no vector DB required) |
| **Agents** | **3** parallel micro-verifiers: `architecture_boundary`, `incident_pattern`, `risk` |
| **Engine** | `POST /api/verify`, orchestrator (`asyncio.gather`), confidence scorer, finding composer |
| **Inference** | Cerebras Gemma + **mock mode** when API key missing |
| **UI** | Web dashboard: **Verify** button, findings list, agent timeline, citation snippets |
| **Trigger** | Manual only (`trigger: manual`) — no file watcher yet |
| **Demo** | Boundary violation in `checkout.py` cites `ARCH_ADR_004` + `INCIDENT_PM_2024_03` |

**MVP explicitly excludes:** MCP, save watcher, post-commit hook, CI gate, architecture-fact UI, doc suggestions panel, RCA swarm, policy Q&A.

### Add-ons — build after MVP (priority order)

| # | Add-on | Value | Effort |
|---|--------|-------|--------|
| A1 | **Live save trigger** (`watch-save.py`, debounced) | Hero “ambient” story | Small |
| A2 | **Agents +2** (`convention`, `doc_drift`) → 5 verifiers | Richer findings | Medium |
| A3 | **MCP server** (`verify_diff`, `get_findings`) | Cursor / agent integration | Medium |
| A4 | **Doc suggestions panel** (gap detector, pending review) | Human-in-the-loop story | Medium |
| A5 | **Architecture facts** (propose → confirm → re-verify) | Trustworthy map | Medium |
| A6 | **Post-commit hook** + **PR verify script** | Team / CI story | Small |
| A7 | **RCA swarm** (test-failure button, parallel hypotheses) | Wow factor | Medium |
| A8 | **Policy Q&A** (`POST /api/ask`, claim verification) | Second demo mode | Large |
| A9 | IDE extension packaging, audit JSON export, nightly scan | Polish / stretch | Variable |

Pick add-ons top-down only after MVP demo runs twice without failure.

### Will not have (any phase in hackathon)

- Auto-fix code or auto-edit ADRs
- Multi-tenant auth
- Production GitHub App / OAuth
- Full semantic code search at scale
- SOC2 audit logging

---

## 14. Demo Use Case

### Setup

Northstar Bank monorepo: `web`, `api`, `payments` packages. ADR-004 forbids `web` → `payments` direct imports. Postmortem `INCIDENT_PM_2024_03` describes outage from boundary violation.

### Hero demo flow (60 seconds)

**MVP script:**

1. Open dashboard → click **Verify** on clean `checkout.py` → no high findings.
2. Add `from payments.client import charge_customer` to `checkout.py`.
3. Click **Verify** again → within ~2s: **High** boundary finding cites `ARCH_ADR_004` + `INCIDENT_PM_2024_03`.
4. Agent timeline shows **3** micro-verifiers finishing in parallel.

**With add-ons (layer on when built):**

5. (A1) Save file → finding appears without clicking Verify.
6. (A4) Doc suggestion panel → `pending_review`.
7. (A6) PR verify script → same finding in CI summary.

### Contrast moment

> “A knowledge MCP retrieves ADR-004 when you ask. TrustLoop verified your edit before you committed.”

---

## 15. Success Metrics

### Hackathon

- Judges understand ambient verification in &lt; 15 seconds
- Live violation demo feels instant
- Parallel agent fan-out is visible
- At least one finding tied to incident/postmortem corpus
- Clear differentiation from retrieve-only MCP

### Product (future)

- Mean time to detect boundary violation (editor vs PR)
- % findings acknowledged vs ignored
- Doc drift findings → approved ADR updates
- Verification runs per developer per day (frequency metric enabled by Cerebras)

---

## 16. Positioning

### One-liner

TrustLoop is ambient code assurance — parallel Gemma verifiers on Cerebras that check every change against your architecture, conventions, and engineering history.

### Short pitch

Enterprise knowledge tools retrieve answers. TrustLoop verifies code continuously: scoped diffs, parallel micro-agents, citation-backed findings, and a human-confirmed architecture map — fast enough to run on save, not just on PR.

---

## 17. Build Plan — 2 People (MVP → Add-ons)

**Team:** 2 builders. **Rule:** nothing in the add-on list starts until MVP demo passes twice.

Suggested split:

| | **Person A — Engine** | **Person B — Product surface** |
|--|------------------------|--------------------------------|
| Owns | Backend, agents, indexer, retriever, API, Cerebras, mock mode | Frontend, demo repo, corpus, fixtures, demo script |
| Sync points | Defines `VerificationRun` JSON first (hour 1) | Builds UI against fixture immediately |
| Integration | Wires real `/api/verify` | Connects UI + runs demo script |

Rough timeboxes assume a **24-hour hackathon** (~12h productive each). Adjust proportionally.

---

### Phase 0 — Unblock (both, ~2 hours)

| Person A | Person B |
|----------|----------|
| Pydantic models + `fixtures/verification_run_violation.json` | Same fixture → UI types |
| FastAPI skeleton + mock `POST /api/verify` returns fixture | Dashboard layout: findings, timeline, citations (static) |
| `.env.example`, `pyproject.toml` | `demo_repo/` skeleton + `engineering_corpus/` (ADR + postmortem) |

**Done when:** UI renders violation fixture; API returns it on POST.

---

### Phase 1 — MVP core (~8 hours)

| Person A | Person B |
|----------|----------|
| Import graph indexer + keyword retriever | Wire **Verify** button → API |
| Cerebras client + mock fallback | Show changed file path + diff summary in UI |
| 3 agents: `architecture_boundary`, `incident_pattern`, `risk` | Finding cards: severity, confidence, citations |
| Orchestrator + confidence + composer | Agent timeline + latency panel |
| Real `POST /api/verify` replaces mock | Seed `checkout.py` clean + violation versions |

**Done when:** Click Verify on bad import → real Cerebras (or mock) finding in &lt; 2s with 3 agents in timeline.

---

### Phase 2 — MVP harden (~2 hours, both)

| Task | Owner |
|------|-------|
| `DEMO_SCRIPT.md` + reset script | B |
| Error states (agent failure, no API key) | A |
| Empty state (clean verify) + one UI polish pass | B |
| End-to-end smoke test twice | Both |

**Done when:** MVP demo is judge-ready. **Stop and reassess** before add-ons.

---

### Phase 3+ — Add-ons (pick by priority, ~2–4h each)

Work in parallel where possible; each add-on should not break MVP demo.

| Add-on | Person A | Person B |
|--------|----------|----------|
| **A1** Save trigger | `watch-save.py` → POST verify | UI auto-refresh on new run |
| **A2** +2 agents | `convention`, `doc_drift` agents + orchestrator | Timeline shows 5 agents |
| **A3** MCP | `backend/mcp/server.py` tools | — |
| **A4** Doc suggestions | `gap_detector`, `suggestion_generator` | Suggestions panel |
| **A5** Arch facts | `fact_proposer`, `review_store` | Confirm/reject UI |
| **A6** Git/CI | `post-commit-verify.sh`, `verify-pr.sh` | PR summary in README |
| **A7** RCA swarm | `rca_swarm.py` + endpoint | “Simulate test failure” button |
| **A8** Policy Q&A | `/api/ask` + claim agents | Optional second tab |

### Dependency graph (2-person)

```txt
Phase 0:  A: models + mock API  ||  B: UI + demo_repo + corpus
              \                    /
               v                  v
Phase 1:  A: indexer → agents → orchestrator
          B: UI wired → findings + timeline
              \                    /
               v                  v
Phase 2:  MVP demo frozen ──────────────────► then add-ons A1→A9
```

### If you fall behind

Cut in this order (keep MVP):

1. Drop add-ons entirely — ship MVP only
2. Mock mode only at demo (no live Cerebras)
3. 2 agents instead of 3 (`architecture_boundary` + `incident_pattern` only)
4. Simplest UI (single page, no polish)

---

## 18. Appendix: Policy Q&A Mode (optional demo module)

The original TrustLoop policy Q&A flow (question → answer → claim verification) remains a **valid secondary demo** using the same engine:

- `POST /api/ask` — natural language question over engineering + policy corpus
- Claim extraction + parallel verifiers on **answer claims** instead of **code diffs**

This module reuses: retriever, Cerebras parallel pattern, confidence aggregator, citation UI. **Add-on A8** — only after MVP is frozen.

---

## 19. Related Documents

- `docs/ARCHITECTURE.md` — component contracts, prompts, folder structure (update in sync with this PRD)
- `docs/DEMO_SCRIPT.md` — authored in MVP Phase 2
- `CLAUDE.md` — implementation guardrails for agents
