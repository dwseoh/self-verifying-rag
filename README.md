# TrustLoop

TrustLoop is an ambient code assurance layer powered by Gemma on Cerebras.

It continuously verifies code changes against architecture rules, engineering conventions, ADRs, and past incidents — running parallel micro-verifier agents on each verify. Findings ship with citations and confidence scores.

## Quick start

```bash
pip install -e .
cp .env.example .env          # set CEREBRAS_API_KEY or TRUSTLOOP_MOCK=1
uvicorn backend.app:app --reload --port 8000
./scripts/seed-violation.sh   # optional demo state
```

See `docs/IMPLEMENTATION.md` for MVP scope and 2-person work split.  
See `docs/CEREBRAS_GEMMA.md` for API usage.
