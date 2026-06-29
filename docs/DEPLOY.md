# Deploying TrustLoop as a SaaS website

## Architecture

| Layer | Host | Role |
|-------|------|------|
| **Frontend** | Vercel | Next.js app — auth, dashboard, webhooks, MCP install script |
| **Database** | Neon Postgres | Users, sessions, repos, verification runs |
| **Backend** | Railway / Fly / VM | Python FastAPI — verify pipeline, clone, local discovery |

The frontend proxies `/backend/*` to the Python API (`TRUSTLOOP_BACKEND_URL`).

## 1. Neon database

1. Create a project at [neon.tech](https://neon.tech).
2. Run the migration SQL:

```bash
psql "$DATABASE_URL" -f frontend/drizzle/migrations/0000_init.sql
```

Or from `frontend/`:

```bash
cp .env.example .env.local   # set DATABASE_URL
npm run db:push
```

## 2. Frontend env (Vercel)

Set in Vercel → Project → Environment Variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `GITHUB_ID` / `GITHUB_SECRET` | OAuth app callback: `https://your-app.vercel.app/api/auth/callback/github` |
| `GITHUB_WEBHOOK_SECRET` | Random secret for PR webhooks |
| `TRUSTLOOP_WEBHOOK_URL` | `https://your-app.vercel.app/api/webhooks/github` |
| `TRUSTLOOP_BACKEND_URL` | Python API URL (e.g. Railway) |
| `TRUSTLOOP_PUBLIC_API_URL` | Same as backend URL (used in MCP install script) |

## 3. Python backend env

Deploy `uvicorn backend.app:app` with:

- `CEREBRAS_API_KEY`
- `TRUSTLOOP_ALLOW_ABSOLUTE_PATHS=1` (self-hosted / local discovery)
- `TRUSTLOOP_CLONES_PATH=/data/clones`
- `GITHUB_CLONE_TOKEN` (optional, for private repos)
- `TRUSTLOOP_PUBLIC_API_URL` (your public backend URL)
- `TRUSTLOOP_GIT_REPO` (your repo URL for MCP installer)

## 4. GitHub OAuth scopes

Users sign in with GitHub to list repos and register webhooks. Scopes: `read:user`, `user:email`, `repo`, `admin:repo_hook`.

When a user connects a GitHub repo in the dashboard, TrustLoop registers a webhook for `pull_request` and `push` events.

## 5. PR CI (two options)

**A. Hosted webhook (automatic)** — Connect repo in dashboard → PRs trigger `/api/webhooks/github` → verify → commit status + PR comment → run saved in Neon.

**B. GitHub Action** — Add `.github/workflows/trustloop-verify.yml` and set repo secrets:

- `TRUSTLOOP_API_URL` — your Python backend
- `TRUSTLOOP_API_TOKEN` — optional future auth

## 6. MCP (no hardcoded paths)

**Connect MCP** in the repo dashboard returns:

```bash
curl -fsSL 'https://your-app.vercel.app/api/mcp/install.sh?repo_path=...' | bash
```

The script clones TrustLoop to `~/.local/share/trustloop`, installs MCP deps, and writes `~/.cursor/mcp.json` with `TRUSTLOOP_API_URL` pointing at your deployed backend.

## 7. Local repo import

On the machine running the Python backend, `GET /api/repos/discover?q=...` searches common paths (`~/Documents/Repositories`, etc.). Override with:

```bash
TRUSTLOOP_DISCOVERY_ROOTS=/Users/you/code:/opt/repos
```

Users pick from search results or paste an absolute path — not limited to `data/`.

## Local dev

```bash
# Terminal 1 — backend
uvicorn backend.app:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
cp .env.example .env.local   # fill DATABASE_URL, AUTH_SECRET, GITHUB_*
npm install
npm run dev
```

Open http://localhost:5173 → sign up → add repo.
