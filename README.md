# TrustLoop

Parallel code verification against repo rules, docs, and dependency graph. Backend: FastAPI + Gemma on Cerebras. Frontend: Next.js dashboard.

## Prerequisites

- Python 3.11+
- Node 20+
- [Neon](https://neon.tech) Postgres (for auth, repos, run history)

## Setup

**Backend**

```bash
pip install -e ".[dev]"
cp .env.example .env
# Set CEREBRAS_API_KEY or TRUSTLOOP_MOCK=1
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
```

Fill `frontend/.env.local`:

```bash
DATABASE_URL=postgresql://...
AUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:5173
TRUSTLOOP_BACKEND_URL=http://localhost:8000
```

**Database** (once)

```bash
cd frontend
npm run db:push
# or: psql "$DATABASE_URL" -f drizzle/migrations/0000_init.sql
```

## Run

```bash
# terminal 1
uvicorn backend.app:app --reload --port 8000

# terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173 — sign up, add a local git repo path, start a run.

## Optional

| Feature | Env vars |
|---------|----------|
| GitHub sign-in / import | `GITHUB_ID`, `GITHUB_SECRET` in `frontend/.env.local` |
| PR webhooks | `GITHUB_WEBHOOK_SECRET`, `TRUSTLOOP_WEBHOOK_URL` |
| Live inference | `CEREBRAS_API_KEY` in `.env` (remove `TRUSTLOOP_MOCK`) |

## Docs

- `docs/ARCHITECTURE.md` — system design
- `docs/DEPLOY.md` — Vercel + production env
