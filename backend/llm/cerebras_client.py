import json
import time
import uuid
from pathlib import Path

from openai import AsyncOpenAI

from backend.config import ROOT, settings

FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "title": {"type": "string"},
                    "explanation": {"type": "string"},
                    "citation_ids": {"type": "array", "items": {"type": "string"}},
                    "related_paths": {"type": "array", "items": {"type": "string"}},
                    "recommended_fix": {"type": "string"},
                },
                "required": [
                    "severity",
                    "title",
                    "explanation",
                    "citation_ids",
                    "related_paths",
                    "recommended_fix",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["findings"],
    "additionalProperties": False,
}


def _load_mock(agent_name: str) -> dict:
    path = ROOT / "fixtures" / "agent_mocks" / f"{agent_name}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"findings": []}


async def complete_json(
    *,
    agent_name: str,
    system: str,
    user: str,
    schema_name: str = "verifier_findings",
    schema: dict | None = None,
) -> tuple[dict, int]:
    """Return (parsed_json, latency_ms). Uses mock when TRUSTLOOP_MOCK or no API key."""
    schema = schema or FINDINGS_SCHEMA

    if settings.use_mock:
        return _load_mock(agent_name), 50

    client = AsyncOpenAI(
        base_url=settings.cerebras_base_url,
        api_key=settings.cerebras_api_key,
    )

    start = time.perf_counter()
    response = await client.chat.completions.create(
        model=settings.cerebras_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
        top_p=0.95,
        max_tokens=2048,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        },
    )
    latency_ms = int((time.perf_counter() - start) * 1000)
    content = response.choices[0].message.content or "{}"
    return json.loads(content), latency_ms
