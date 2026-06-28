from backend.agents import base

AGENT_NAME = "architecture_boundary"
SYSTEM = (
    "You are the architecture boundary verifier for TrustLoop. "
    "Return JSON only. Flag cross-service import violations using corpus citation IDs."
)


async def run(ctx: base.AgentContext) -> base.AgentResult:
    return await base.run_verifier_agent(
        agent_name=AGENT_NAME,
        system=SYSTEM,
        ctx=ctx,
        focus="service boundaries, layer violations, forbidden imports between web and payments",
    )
