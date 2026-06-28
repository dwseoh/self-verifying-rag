# TrustLoop

TrustLoop is an ambient code assurance layer powered by Gemma on Cerebras.

It continuously verifies code changes against architecture rules, engineering conventions, ADRs, and past incidents — running many micro-verifier agents in parallel on every meaningful edit, commit, or PR. Findings ship with citations and confidence scores, not just retrieved docs.

## Why Cerebras?

Verification only works if it runs often enough to matter. Cerebras makes parallel micro-inference fast enough for live save-time checks, not just slow PR audits. See `docs/PRD.md` for sprint plan and scope.
