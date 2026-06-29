# TrustLoop Frontend

Repo-centric SaaS dashboard (Vercel-inspired design).

## Run

```bash
# Backend
uvicorn backend.app:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Flow

1. **Repositories** — register a local path (`data/demo_repo`, `data/orbital`, …)
2. **Click a repo** — opens project dashboard (like Vercel)
3. **Runs tab** — start a run (indexes whole repo, verifies selected scope)
4. **Index tab** — graph ingestion stats
5. **Rules tab** — auto-detected markdown rules from `docs/trustloop_corpus/` in the repo
6. **Settings** — Save & test backend / Cerebras connection

## Verify vs Runs

There is only **Runs**. A run = index whole repo (cached) → resolve diff scope → load rules → parallel agents → findings.

## Corpus

No manual corpus path. Backend auto-discovers, in order:

- `docs/trustloop_corpus/`
- `docs/engineering_corpus/`
- `engineering_corpus/`
- `.trustloop/corpus/`
- fallback: global `data/engineering_corpus/`

## Routes

| Path | Purpose |
|------|---------|
| `/app/repositories` | List + register repos |
| `/app/repos/[id]` | Repo dashboard (Runs / Index / Rules) |
| `/app/settings` | API + backend config |

Legacy static UI: `frontend/_legacy/`
