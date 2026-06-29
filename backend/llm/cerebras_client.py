import asyncio
import json
import logging
import re
import time
from pathlib import Path

from openai import AsyncOpenAI

from backend.config import ROOT, settings

logger = logging.getLogger(__name__)

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


def _parse_json_content(content: str) -> dict:
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


async def check_llm_connection() -> dict:
    """Ping Cerebras with a tiny completion. Used by /health."""
    if settings.use_mock:
        return {"status": "mock", "model": settings.cerebras_model, "latency_ms": 0}

    client = AsyncOpenAI(
        base_url=settings.cerebras_base_url,
        api_key=settings.cerebras_api_key,
    )
    start = time.perf_counter()
    try:
        response = await client.chat.completions.create(
            model=settings.cerebras_model,
            messages=[{"role": "user", "content": 'Reply with JSON: {"ok": true}'}],
            max_tokens=32,
            response_format={"type": "json_object"},
        )
        latency_ms = int((time.perf_counter() - start) * 1000)
        return {
            "status": "ok",
            "model": settings.cerebras_model,
            "latency_ms": latency_ms,
            "sample": (response.choices[0].message.content or "")[:80],
        }
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "model": settings.cerebras_model, "error": str(exc)}


async def complete_json(
    *,
    agent_name: str,
    system: str,
    user: str,
    schema_name: str = "verifier_findings",
    schema: dict | None = None,
    use_mock_findings: bool = True,
) -> tuple[dict, int]:
    """Return (parsed_json, latency_ms). Mock when TRUSTLOOP_MOCK=1 or no API key."""
    schema = schema or FINDINGS_SCHEMA

    if settings.use_mock:
        mock_latency_ms = 50 if use_mock_findings else 45
        await asyncio.sleep(mock_latency_ms / 1000)
        if not use_mock_findings:
            return {"findings": []}, mock_latency_ms
        return _load_mock(agent_name), mock_latency_ms

    client = AsyncOpenAI(
        base_url=settings.cerebras_base_url,
        api_key=settings.cerebras_api_key,
    )

    last_error: Exception | None = None
    for attempt in range(2):
        start = time.perf_counter()
        try:
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
            return _parse_json_content(content), latency_ms
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("Cerebras call failed for %s (attempt %s): %s", agent_name, attempt + 1, exc)
            if attempt == 0:
                await asyncio.sleep(0.5)

    raise last_error or RuntimeError(f"Cerebras call failed for {agent_name}")
