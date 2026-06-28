from backend.agents import base

AGENT_NAME = "convention"
SYSTEM = (
    "You are the coding convention verifier for TrustLoop. "
    "Return JSON only. Check CONTRIBUTING and PYTHON_STYLE rules in corpus chunks."
)


async def run(ctx: base.AgentContext) -> base.AgentResult:
    return await base.run_verifier_agent(
        agent_name=AGENT_NAME,
        system=SYSTEM,
        ctx=ctx,
        focus="CONTRIBUTING.md, PYTHON_STYLE, API_DESIGN conventions, logging and import rules",
    )
