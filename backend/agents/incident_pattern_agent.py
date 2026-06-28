from backend.agents import base

AGENT_NAME = "incident_pattern"
SYSTEM = (
    "You are the incident pattern verifier for TrustLoop. "
    "Return JSON only. Match code changes to postmortem anti-patterns in the corpus."
)


async def run(ctx: base.AgentContext) -> base.AgentResult:
    return await base.run_verifier_agent(
        agent_name=AGENT_NAME,
        system=SYSTEM,
        ctx=ctx,
        focus="similarity to past incidents and postmortems, repeat failure patterns",
    )
