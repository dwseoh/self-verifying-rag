from backend.agents import base

AGENT_NAME = "risk"
SYSTEM = (
    "You are the risk verifier for TrustLoop. "
    "Return JSON only. Assess compliance, privacy, and security risk of the change."
)


async def run(ctx: base.AgentContext) -> base.AgentResult:
    return await base.run_verifier_agent(
        agent_name=AGENT_NAME,
        system=SYSTEM,
        ctx=ctx,
        focus="data handling, PII, payment data, third-party exposure, human review need",
    )
