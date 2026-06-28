import os

import pytest

from backend.llm.cerebras_client import check_llm_connection, complete_json

pytestmark = pytest.mark.skipif(
    not os.environ.get("CEREBRAS_API_KEY"),
    reason="Set CEREBRAS_API_KEY to run live LLM tests",
)


@pytest.mark.asyncio
async def test_cerebras_health():
    result = await check_llm_connection()
    assert result["status"] == "ok"
    assert result["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_cerebras_structured_json():
    data, ms = await complete_json(
        agent_name="architecture_boundary",
        system="Return JSON only.",
        user='Flag if diff imports packages.payments from web. Diff:\nfrom packages.payments.client import x',
        use_mock_findings=True,
    )
    assert ms >= 0
    assert "findings" in data
