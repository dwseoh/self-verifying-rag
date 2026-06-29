# TrustLoop MVP Demo (60s)

## Prereqs

```bash
pip install -e .
cp .env.example .env   # TRUSTLOOP_MOCK=1 works without API key
uvicorn backend.app:app --reload --port 8000

cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Steps

1. **Open dashboard** — go to Repositories and open the demo repo.
2. **Reset clean** — click `Reset clean` in the Runs tab.
3. **Clean verify** — click `Verify checkout.py` → no high-severity findings.
4. **Seed violation** — click `Seed violation`.
5. **Violation verify** — click `Verify checkout.py` again.
6. **Show proof** — high finding cites `ARCH_ADR_004` + `INCIDENT_PM_2024_03`.
7. **Show speed** — agent timeline shows parallel verifiers and `latency.parallel_verification_ms`.

## Curl

```bash
curl -s -X POST http://localhost:8000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"repo_path":"data/demo_repo","changed_paths":["apps/web/checkout.py"],"trigger":"manual"}' | jq .
```

## Pitch line

> A knowledge MCP retrieves ADR-004 when you ask. TrustLoop verified the change with parallel Gemma agents before merge.
