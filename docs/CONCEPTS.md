# TrustLoop Concepts

**Read this to understand how the pieces fit together.**  
Implementation details: `IMPLEMENTATION.md`. Contracts: `ARCHITECTURE.md`.

---

## Quick answers

| Question | MVP answer |
|----------|------------|
| **Database?** | **No** for core pipeline. Optional JSON files for review state. Postgres/Neon only if you deploy shared state later. |
| **Embeddings?** | **Not required for MVP.** Keyword search over ~10 corpus sections is enough. Add embeddings in add-on when corpus grows. |
| **What is indexed?** | **Two separate indexes:** (1) code repo graph, (2) engineering corpus chunks. They are not the same thing. |
| **Subgraph?** | The **small slice of the import graph** near changed files — not the whole repo. |
| **Corpus chunks?** | **Paragraph-sized pieces of markdown docs** (ADRs, postmortems) with citation IDs. |

---

## 1. Two indexes (do not confuse them)

TrustLoop pulls context from **two sources** on every verify:

```txt
┌─────────────────────┐     ┌──────────────────────────┐
│  CODE REPO INDEX    │     │  ENGINEERING CORPUS      │
│  (deterministic)    │     │  (markdown knowledge)    │
│                     │     │                          │
│  demo_repo/         │     │  engineering_corpus/     │
│  *.py import graph  │     │  ADRs, postmortems, etc. │
└──────────┬──────────┘     └────────────┬─────────────┘
           │                             │
           v                             v
    Repo subgraph                  Corpus chunks
    + file diff                    (top 5 by relevance)
           │                             │
           └──────────┬──────────────────┘
                      v
              AgentContext (prompt input)
                      v
              3 parallel LLM verifiers
```

| Index | What it stores | MVP how | Needs DB? | Needs embeddings? |
|-------|----------------|---------|-----------|-------------------|
| **Repo index** | Files, import edges, blast radius | Parse Python AST on each request (tiny demo repo) | No | No |
| **Corpus index** | ADR/postmortem sections with `ARCH_ADR_004` IDs | Split markdown by `##` headers; keyword match | No | No (add later) |

**You do not put code in the vector DB.** Code context goes in as **raw diff text + graph excerpt**. Corpus goes in as **retrieved markdown chunks**.

---

## 2. Repo indexing (the hard part — phased)

### What “index the repo” means

Build a **structural model** of the codebase so verifiers know:

- Which file changed
- What it imports / what imports it
- Which service boundary that implies (`web` vs `payments`)

This is **not** semantic search over code. It is **graph + text**.

### MVP (what we have now)

```python
# backend/indexer/graph.py — runs every verify on demo_repo (~5 files)

build_graph(repo)
  → walk all *.py
  → ast.parse each file
  → edges: checkout.py → packages.payments.client

affected_paths(changed_files, graph)
  → changed file + 1-hop neighbors

diff_summary_for_paths(repo, changed_files)
  → full text of changed files (the "diff" for MVP)

graph_excerpt(graph, scope)
  → text lines: "apps/web/checkout.py -> packages.payments"
```

**Incremental indexing:** MVP does **not** increment — it rebuilds the whole tiny graph each time (~milliseconds). That is fine for 5–50 files.

### Add-on: incremental repo index

When the repo is real-sized:

```txt
.git watch or post-commit
    → compute changed files since last index
    → update only those nodes/edges in cached graph
    → persist graph to data/store/repo_graph.json (or SQLite)
```

| Stage | Strategy |
|-------|----------|
| MVP | Full rebuild per verify |
| Add-on | File watcher + mtime cache |
| Production | Persistent graph DB + incremental AST updates on commit |

**Forms of repo indexing (future):**

| Layer | Source | Purpose |
|-------|--------|---------|
| Import graph | AST | Boundaries, blast radius |
| Package map | `pyproject.toml`, folders | Service labels |
| API surface | OpenAPI, route decorators | HTTP boundary checks |
| Git diff | `git diff base..head` | Real PR scope (not full file) |

MVP skips git diff and uses full file content — good enough for demo.

---

## 3. Corpus retriever (how it works)

### Corpus = your engineering wiki as files

```
data/engineering_corpus/
  adrs/ARCH_ADR_004_service_boundaries.md
  incidents/INCIDENT_PM_2024_03_payments_bypass.md
  CONTRIBUTING.md
```

Each section starts with a citation header:

```md
## ARCH_ADR_004: Service Boundary Rules

The web application must not import from packages/payments...
```

### Chunking (index time)

```python
load_corpus()
  → for each .md file
  → split on "## " headers
  → each section = one CorpusChunk { citation_id, text, ... }
```

~10–30 chunks total in MVP. **Loaded into memory** each request (no DB).

### Retrieval (query time)

```python
query = diff_text + changed_paths   # e.g. "checkout.py ... payments ..."
chunks = retrieve(query, all_chunks, top_k=5)
```

**MVP:** keyword overlap scoring (count matching words).  
**Add-on:** embed query + chunks with a small model → cosine similarity (Chroma/FAISS/in-memory).

### Do you need embeddings?

| Corpus size | Recommendation |
|-------------|----------------|
| &lt; 50 chunks (MVP) | Keyword is fine |
| 50–500 chunks | Embeddings help |
| Enterprise wiki | Embeddings + metadata filters (doc type, team) |

Embeddings are **only for corpus retrieval**, not for repo structure.  
You can ship MVP without any embedding API.

```txt
Add-on embedding pipeline:

  corpus markdown
       → chunk by ## headers
       → embed each chunk (one-time or on file change)
       → store vectors in memory JSON or Chroma
       → at verify: embed(query) → top_k similar chunks
```

Still no Postgres required — Chroma can be a local folder.

---

## 4. Context setup: subgraph + chunks → AgentContext

This is what actually goes into each LLM call.

### Step-by-step on one verify

```txt
INPUT: changed_paths = ["apps/web/checkout.py"]

STEP 1 — Repo side
  graph = build_graph(demo_repo)
  scope = affected_paths(["apps/web/checkout.py"], graph)
         → ["apps/web/checkout.py", "packages/payments/client", ...]

  diff_summary = full file text (MVP) or git diff (add-on)

  graph_excerpt = edges touching scope
         → "apps/web/checkout.py -> packages.payments.client"

STEP 2 — Corpus side
  query = diff_summary + path names
  corpus_chunks = top 5 sections mentioning "payments", "web", "import", etc.
         → [ ARCH_ADR_004 chunk, INCIDENT_PM_2024_03 chunk, ... ]

STEP 3 — Bundle
  AgentContext {
    diff_summary:     "...from packages.payments.client import..."
    changed_paths:    ["apps/web/checkout.py"]
    graph_excerpt:    "checkout.py -> packages.payments.client"
    corpus_chunks:    [ { citation_id: "ARCH_ADR_004", text: "..." }, ... ]
  }
```

### What is the “subgraph”?

The **subgraph** is not a separate database object. It is:

- The set of **files in scope** (`affected_paths`)
- Plus the **import edges** between them (`graph_excerpt`)

Think: “neighborhood of the change” — not the whole monorepo.

```txt
Full repo graph (all files)          Subgraph for this verify
                                    
  web/checkout ──► payments/client       web/checkout ──► payments/client
  api/gateway  ──► payments/client              (only edges near the change)
  api/gateway  ──► ...
```

Agents use the subgraph to see **structure**; they use **corpus chunks** to see **rules and history**.

### Why both?

| Source | Answers |
|--------|---------|
| Subgraph + diff | “What did the code actually do?” |
| Corpus chunks | “What do our rules say about that?” |

A knowledge MCP only gives you the second half. TrustLoop combines both, then **verifies** the match.

---

## 5. Agents: work and data contracts

### Flow

```txt
AgentContext (same for all 3 agents)
        │
        ├──► architecture_boundary_agent  ──► AgentResult
        ├──► incident_pattern_agent       ──► AgentResult
        └──► risk_agent                   ──► AgentResult
                        │
                        v (asyncio.gather — parallel)
                 compose_findings()
                 score_confidence()
                        │
                        v
                 VerificationRun (API response)
```

### Per-agent contract

**Input:** `AgentContext` (shared — not per-agent custom inputs in MVP)

**Output:** `AgentResult`

```json
{
  "agent": "architecture_boundary",
  "status": "ok",
  "latency_ms": 138,
  "findings": [
    {
      "id": "f_abc",
      "severity": "high",
      "confidence": 75,
      "title": "Direct web to payments import",
      "explanation": "...",
      "citation_ids": ["ARCH_ADR_004"],
      "related_paths": ["apps/web/checkout.py"],
      "recommended_fix": "Use payments_gateway",
      "detected_by": ["architecture_boundary"]
    }
  ],
  "error": null
}
```

Each agent is **one Cerebras call** → JSON with a `findings` array (see `docs/CEREBRAS_GEMMA.md`).

### Final API contract

**`VerificationRun`** = what the UI / MCP / CI all consume:

```json
{
  "id": "run_xxx",
  "findings": [ ... ],
  "agent_timeline": [
    { "agent": "architecture_boundary", "status": "ok", "latency_ms": 138 }
  ],
  "retrieved_chunks": [ ... ],
  "latency": { "parallel_verification_ms": 138, "total_ms": 203 },
  "overall_confidence": 82,
  "risk_level": "high"
}
```

Defined in `backend/models/verification.py` and `fixtures/verification_run_violation.json`.

### Composer merges agent outputs

- Dedupe findings with same title + paths
- Merge `detected_by` lists
- Attach `evidence_snippets` from `corpus_chunks` by `citation_id`
- Apply deterministic confidence penalties

---

## 6. Surfaces: what each tool does

**One engine.** Multiple ways to invoke it and display results.

```txt
                    ┌─────────────────────┐
                    │  Verification engine │
                    │  run_verification()  │
                    └──────────▲──────────┘
                               │
     ┌─────────────┬───────────┼───────────┬─────────────┐
     │             │           │           │             │
     v             v           v           v             v
  Web UI       CLI/curl    MCP server   save watcher   CI script
  (MVP)        (MVP)       (add-on A3)  (add-on A1)   (add-on A6)
```

| Surface | Who uses it | MVP? | What it does |
|---------|-------------|------|--------------|
| **Web dashboard** | Human demo / dev | **Yes** | Verify button → show findings, timeline, citations |
| **HTTP API** | Everything | **Yes** | `POST /api/verify` — the single integration point |
| **CLI / curl** | Dev, scripts | **Yes** | Same POST; no UI needed |
| **MCP server** | Cursor / Claude agent | Add-on | Exposes `verify_diff`, `get_findings` as tools the coding agent can call |
| **Save watcher** | Local daemon | Add-on | On file save → auto POST verify → refresh UI |
| **CI / PR script** | GitHub Actions | Add-on | On PR → verify branch diff → fail or comment |

### MCP is not a separate brain

```txt
WRONG:  Cursor → MCP → "retrieve ADR" → done

RIGHT:  Cursor → MCP tool verify_diff → TrustLoop engine
                                              → indexer + corpus + agents
                                              → returns VerificationRun JSON
```

MCP tools are **thin wrappers** over `POST /api/verify`. Background verification needs a **runner** (watcher, git hook, CI) that calls the same API.

### CLI example (works today)

```bash
curl -X POST http://localhost:8000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"repo_path":"data/demo_repo","changed_paths":["apps/web/checkout.py"]}'
```

---

## 7. Storage summary (what needs what)

| Data | MVP storage | Embeddings? | When to upgrade |
|------|-------------|-------------|-----------------|
| Source code | Git / filesystem | No | — |
| Repo import graph | Rebuilt in memory | No | Cache JSON → incremental updates |
| Corpus markdown | Files on disk | No | — |
| Corpus search index | In-memory keyword | Optional later | Chroma when &gt;50 chunks |
| Verification runs | Optional `runs.jsonl` | No | Postgres if querying history |
| Review / facts | JSON files | No | Neon if multi-user deployed |

**Neon/Postgres** = app state (reviews, audit queries), **not** vector search.  
**Vector DB** = corpus retrieval at scale. They solve different problems.

---

## 8. Nontrivial work ranked (2 people)

| Priority | Work | Owner | MVP vs later |
|----------|------|-------|--------------|
| 1 | **Agent prompts + JSON schema** — reliable findings | A | MVP |
| 2 | **Orchestrator + contracts** — parallel gather, compose | A | MVP |
| 3 | **Corpus chunking + keyword retrieve** | A | MVP |
| 4 | **Import graph + subgraph scope** | A | MVP (simple) |
| 5 | **UI against VerificationRun** | B | MVP |
| 6 | **Git diff instead of full file** | A | Add-on |
| 7 | **Incremental repo graph cache** | A | Add-on |
| 8 | **Corpus embeddings** | A | Add-on |
| 9 | **MCP + CI + watcher** | A | Add-on |

---

## 9. Mental model (one paragraph)

On each verify, TrustLoop reads **what changed in code** (diff + import subgraph), retrieves **which rules might apply** (corpus chunks), sends **both** to **parallel Gemma verifiers** on Cerebras, each returning structured **findings** with **citation IDs**, then merges them into one **VerificationRun** for the UI, CLI, MCP, or CI. No database or embeddings required for MVP — just files, AST, keywords, and JSON contracts.
