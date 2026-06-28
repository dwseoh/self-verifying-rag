# Cerebras Gemma 4 — Agent Reference

**For TrustLoop implementers and coding agents.** How to call `gemma-4-31b` on Cerebras for parallel micro-verifiers.

Official docs:

- [Gemma 4 31B model card](https://inference-docs.cerebras.ai/models/gemma-4-31b)
- [Chat Completions API](https://inference-docs.cerebras.ai/api-reference/chat-completions)
- [Reasoning (`reasoning_effort`)](https://inference-docs.cerebras.ai/capabilities/reasoning#gemma-4-31b-reasoning_effort)
- [Structured Outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
- [OpenAI compatibility](https://inference-docs.cerebras.ai/resources/openai)
- Full index: https://inference-docs.cerebras.ai/llms.txt

---

## 1. Model ID and limits

| Field | Value |
|-------|--------|
| **Model ID** | `gemma-4-31b` |
| **Endpoint** | `POST https://api.cerebras.ai/v1/chat/completions` |
| **Auth** | `Authorization: Bearer $CEREBRAS_API_KEY` |
| **Context** | 65k tokens (free tier), 131k (paid) |
| **Max output** | 32k (free), 40k (paid) |
| **Speed** | ~1500 tokens/sec (marketing figure; measure per call in agent timeline) |
| **Modality** | Text + image (images: Chat Completions only; MVP uses text only) |

**Free tier rate limits (check current docs):** ~5 req/min, 30k input tokens/min, 1M tokens/day.

TrustLoop runs **3 parallel calls per verify** (MVP) → watch rate limits; use mock mode for UI dev.

---

## 2. Environment variables

```bash
# .env
CEREBRAS_API_KEY=csk-...
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1   # optional; this is default
CEREBRAS_MODEL=gemma-4-31b
TRUSTLOOP_MOCK=0   # set 1 to skip API and use fixture agent outputs
```

Never commit `.env`. Never expose the API key in the frontend.

---

## 3. Recommended SDK

Use the **OpenAI-compatible client** (already in `pyproject.toml`) or official Cerebras SDK.

### OpenAI-compatible (used in this repo)

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url=os.environ.get("CEREBRAS_BASE_URL", "https://api.cerebras.ai/v1"),
    api_key=os.environ["CEREBRAS_API_KEY"],
)

response = await client.chat.completions.create(
    model="gemma-4-31b",
    messages=[
        {"role": "system", "content": "You return JSON only."},
        {"role": "user", "content": prompt},
    ],
    temperature=1.0,
    top_p=0.95,
    max_tokens=2048,
    response_format={...},  # see Structured outputs below
)
text = response.choices[0].message.content
```

### Official Cerebras SDK

```python
from cerebras.cloud.sdk import Cerebras

client = Cerebras(api_key=os.environ["CEREBRAS_API_KEY"])
response = client.chat.completions.create(model="gemma-4-31b", messages=[...])
```

Implementation lives in `backend/llm/cerebras_client.py`.

---

## 4. Structured outputs (required for agents)

Micro-verifiers must return **parseable JSON**. Use `json_schema` with `strict: true` for constrained decoding.

```python
response = await client.chat.completions.create(
    model="gemma-4-31b",
    messages=messages,
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "verifier_findings",
            "strict": True,
            "schema": {
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
                            "required": ["severity", "title", "explanation", "citation_ids", "related_paths", "recommended_fix"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["findings"],
                "additionalProperties": False,
            },
        },
    },
)
```

**Schema rules (Cerebras):**

- Root must be `type: object`
- Every object needs `additionalProperties: false` when using `strict: true`
- List all `required` fields

Docs: https://inference-docs.cerebras.ai/capabilities/structured-outputs

---

## 5. Reasoning (`reasoning_effort`)

For **Gemma 4 31B**:

- Reasoning is **disabled by default**
- Set `reasoning_effort` to `"low"`, `"medium"`, or `"high"` to enable
- `"none"` = disabled
- For Gemma 4, active levels are currently **equivalent** (compatibility API)
- **`raw` and `hidden` reasoning formats are NOT supported**

### TrustLoop guidance

| Use case | `reasoning_effort` |
|----------|-------------------|
| MVP micro-verifiers (fast parallel) | **Omit** (default off) |
| Complex RCA swarm (add-on A7) | `"medium"` if latency budget allows |
| Policy Q&A (add-on A8) | Optional `"low"` |

Reasoning adds latency. MVP prioritizes **parallel wall-clock time** over chain-of-thought.

```python
# Only when you need it:
response = await client.chat.completions.create(
    model="gemma-4-31b",
    messages=messages,
    reasoning_effort="medium",
)
```

Docs: https://inference-docs.cerebras.ai/capabilities/reasoning#gemma-4-31b-reasoning_effort

---

## 6. Sampling parameters

Cerebras model card starting point:

```python
temperature=1.0
top_p=0.95
```

For verifiers that must be consistent, you may lower temperature (e.g. `0.3`) — test on your prompts.

---

## 7. Parallel calls pattern

```python
import asyncio

async def run_agents(ctx):
    results = await asyncio.gather(
        run_architecture_boundary_agent(ctx),
        run_incident_pattern_agent(ctx),
        run_risk_agent(ctx),
        return_exceptions=True,
    )
    return [normalize(r) for r in results]
```

- One HTTP request per agent
- Record `latency_ms` per agent for the UI timeline
- `parallel_verification_ms` = wall time of `gather()`, not sum of agents

---

## 8. Error handling

| Failure | Behavior |
|---------|----------|
| 401 / missing key | Fall back to `TRUSTLOOP_MOCK=1` or return 503 with clear message |
| 429 rate limit | Retry once with backoff; then partial result + `verification_incomplete` |
| JSON parse error | `AgentResult(status="error")`, other agents still count |
| Timeout (15s) | Same as parse error |

Never let one agent exception kill the whole `gather()` — use `return_exceptions=True`.

---

## 9. Prompt template (micro-verifier)

```txt
You are the {agent_name} verifier for TrustLoop code assurance.

Rules:
- Use ONLY the diff, graph excerpt, and corpus chunks below.
- Do not invent citation IDs; use only IDs present in corpus chunks.
- If no issue found, return {"findings": []}.
- Return JSON matching the schema exactly.

Diff:
{diff_summary}

Changed paths:
{changed_paths}

Graph excerpt:
{graph_excerpt}

Corpus chunks:
{corpus_chunks}
```

Keep prompts small — scoped context keeps latency low.

---

## 10. Mock mode (no API key)

When `CEREBRAS_API_KEY` is unset or `TRUSTLOOP_MOCK=1`:

- `cerebras_client.complete_json()` loads canned `AgentResult` payloads
- Indexer + retriever still run for real
- UI and demo work offline

---

## 11. Chat Completions request shape (reference)

```http
POST /v1/chat/completions
Authorization: Bearer <CEREBRAS_API_KEY>
Content-Type: application/json

{
  "model": "gemma-4-31b",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "temperature": 1.0,
  "top_p": 0.95,
  "max_tokens": 2048,
  "stream": false,
  "response_format": { "type": "json_schema", "json_schema": { ... } }
}
```

Streaming (`stream: true`) is supported but not needed for MVP verifiers.

---

## 12. What not to use for MVP

- Completions endpoint (`/v1/completions`) — use Chat Completions
- Image inputs — text-only for code verification MVP
- Tool calling — agents return JSON in message body, not tool rounds
- `strict: false` — prefer `strict: true` for agent outputs

---

## 13. Checklist for new agents

1. Add `backend/agents/your_agent.py`
2. Define JSON schema for findings array
3. Call `cerebras_client.complete_json(prompt, schema_name, schema)`
4. Map to `AgentResult` with `agent` name and `latency_ms`
5. Register in `pipeline/orchestrator.py` `asyncio.gather()`
6. Add mock fixture snippet in `fixtures/agent_mocks/` if needed
