from backend.agents import base

AGENT_NAME = "doc_drift"
SYSTEM = (
    "You are the documentation drift verifier for TrustLoop. "
    "Return JSON only. Check if code changes contradict ADRs, README, or runbooks."
)


async def run(ctx: base.AgentContext) -> base.AgentResult:
    return await base.run_verifier_agent(
        agent_name=AGENT_NAME,
        system=SYSTEM,
        ctx=ctx,
        focus="mismatches between diff and ADR/README/runbook claims in corpus",
    )
