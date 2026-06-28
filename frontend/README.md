# Frontend (Person B)

MVP dashboard — not a chat UI.

## Setup

Phase 0 uses a static fixture dashboard so B can move without waiting on A's API.

```bash
cd frontend
python -m http.server 5173
```

Then open `http://localhost:5173`.

## Later setup (suggested: Vite + React + TypeScript)

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
```

Copy types from `fixtures/verification_run_violation.json` into `src/types/verification.ts`.

## MVP screens

1. **Verify** button → `POST http://localhost:8000/api/verify`
2. Findings list (severity badge, confidence, title)
3. Agent timeline (parallel latency bars)
4. Citation evidence panel

### Request body (MVP)

```json
{
  "repo_path": "data/demo_repo",
  "changed_paths": ["apps/web/checkout.py"],
  "trigger": "manual"
}
```

For violation demo, edit `data/demo_repo/apps/web/checkout.py` to add:

```python
from packages.payments.client import charge_customer
```

Then click Verify again (mock mode detects payments import heuristically).

## Contract

`VerificationRun` shape is defined in `backend/models/verification.py` and `fixtures/`.

See `docs/IMPLEMENTATION.md` for work split.
