# TrustLoop MVP Demo (60s)

## Prereqs

```bash
pip install -e .
cp .env.example .env   # TRUSTLOOP_MOCK=1 works without API key
uvicorn backend.app:app --reload --port 8000
```

## Steps

1. **Clean verify** — `POST /api/verify` with default `checkout.py` → no high findings.
2. **Seed violation** — `./scripts/seed-violation.sh`
3. **Violation verify** — same POST → high finding, cites `ARCH_ADR_004` + `INCIDENT_PM_2024_03`.
4. **Show timeline** — 3 agents, parallel wall time in `latency.parallel_verification_ms`.

## Curl

```bash
curl -s -X POST http://localhost:8000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"repo_path":"data/demo_repo","changed_paths":["apps/web/checkout.py"],"trigger":"manual"}' | jq .
```

## Pitch line

> A knowledge MCP retrieves ADR-004 when you ask. TrustLoop verified the change with three parallel Gemma agents before merge.
