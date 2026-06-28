# How TrustLoop Works (plain English)

## What you built (one sentence)

On each verify, TrustLoop **reads what code changed**, **pulls relevant docs**, **asks 3 Gemma agents in parallel** “does this violate our rules?”, then returns **findings with citations**.

---

## The graph (code index) — not embeddings

The **graph** is dependency edges between source files:

```txt
apps/web/checkout.py       →  apps.api.payments_gateway   ✅ allowed path
apps/web/checkout.py       →  packages.payments.client    🚫 boundary violation
apps/web/checkout_native.c →  packages/payments/client.h  (include edge)
```

**How it’s built:** parse **Python** (`import`) and **C/C++** (`#include`) in source files under the repo.  
Supported: `.py`, `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hpp`, `.hxx`.  
**No vectors. No database.** Cached in `data/store/repo_graph_<hash>.json`.

### Incremental indexing (just added)

| First run | Later runs |
|-----------|------------|
| Parse all source files | Only re-parse files whose **mtime changed** |
| Write cache file | Reuse cached edges for unchanged files |

For a **big repo**, you still cache the full graph once; updates are incremental per file.  
**Verify scope** is NOT the whole repo — only **changed files + neighbors**.

### Git diff (just added)

If `repo_path` is a git repo and you pass `base_ref` / `head_ref`:

```json
{
  "repo_path": "data/demo_repo",
  "base_ref": "main",
  "head_ref": "feature/bad-payments-import",
  "trigger": "pr"
}
```

TrustLoop uses `git diff main...HEAD` for:

- **which files changed** (not full repo scan for content)
- **actual diff text** sent to agents (not whole file)

---

## Corpus (docs index) — keyword RAG today

Separate from code graph. Markdown in `data/engineering_corpus/`:

- ADRs (`ARCH_ADR_004`)
- Postmortems (`INCIDENT_PM_2024_03`)
- Conventions (`PYTHON_STYLE_001`)
- Skills (`SKILL_PAYMENTS_001`)
- Policies, runbooks

**Chunking:** split on `## CITATION_ID: Title` headers.  
**Retrieval:** keyword match against diff + paths → top 5 chunks.  
**No embeddings in MVP** (fine for ~20 chunks).

---

## What gets pulled into context (AgentContext)

```txt
1. diff_summary     ← git diff OR full file text
2. changed_paths    ← files you care about
3. graph_excerpt    ← import lines near those files (subgraph)
4. corpus_chunks    ← top 5 doc sections
        ↓
   3 parallel Gemma agents
        ↓
   findings + citations
```

**See it without spending API credits:**

```bash
./scripts/preview-context.sh data/demo_repo
# or POST /api/verify/preview
```

---

## How to test

### 1. Demo repo (start here)

```bash
source .venv/bin/activate
uvicorn backend.app:app --reload --port 8000

# Clean file
./scripts/verify.sh

# Add violation
./scripts/seed-violation.sh
./scripts/verify.sh

# Debug context only
./scripts/preview-context.sh
```

### 2. Demo repo with git branches

```bash
./scripts/init-demo-repo-git.sh
./scripts/verify-branch.sh data/demo_repo main feature/bad-payments-import
```

### 3. Your actual repo (local clone)

```bash
# Put clones under data/ — gitignored, never pushed
# e.g. data/clones/my-project/

./scripts/verify-repo.sh data/clones/my-project src/foo.c src/bar.cpp
./scripts/verify-branch.sh data/clones/my-project main feature-branch
```

Corpus stays `data/engineering_corpus/` (committed demo docs only). Local clones are **code targets**, not ingested docs.

For **repo-specific rules** without committing them, point `.env` at a local folder:

```bash
# .env — local only, never pushed
TRUSTLOOP_CORPUS_PATH=/Users/you/docs/my-project-rules
```

Generic C/C++ conventions (`C_STYLE_*`) ship in the committed corpus; project-specific ADRs stay local.

### 4. Live Cerebras (you have API key)

In `.env`:

```bash
CEREBRAS_API_KEY=csk-...
TRUSTLOOP_MOCK=0
```

Then `./scripts/verify.sh` — agents call real `gemma-4-31b`.

---

## How to trigger verification

| Trigger | How | MVP? |
|---------|-----|------|
| **Manual / curl** | `POST /api/verify` or `./scripts/verify.sh` | ✅ |
| **Preview (no LLM)** | `POST /api/verify/preview` | ✅ |
| **Branch / PR** | `verify-branch.sh` with base/head refs | ✅ |
| **Any repo path** | `verify-repo.sh /path/to/repo` | ✅ |
| Save watcher | `scripts/watch-save.py` | Add-on |
| Post-commit hook | git hook → curl | Add-on |
| CI | GitHub Action | Add-on |
| MCP / IDE | Agent calls tools | Add-on |

There is **no automatic trigger in MVP** — you POST manually or use scripts.

---

## What is NOT built yet

- Embeddings / vector DB
- Postgres / Neon
- Incremental **git** index across monorepo root (demo_repo can be its own git repo)
- Auto-watch on file save
- Per-repo corpus inside target repo (corpus is shared `engineering_corpus/` for now)

---

## Mental model

```txt
         YOUR REPO                         DOCS (corpus)
              │                                  │
    git diff / changed files              keyword retrieve
              │                                  │
              └──────────┬───────────────────────┘
                         v
                   AgentContext
                         v
              3x Gemma on Cerebras
                         v
                   VerificationRun
```

**Graph** = how code connects.  
**Chunks** = what rules/history say.  
**Agents** = judge whether they align.
