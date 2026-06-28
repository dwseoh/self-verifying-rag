# TrustLoop Architecture

## 1. Architecture Summary

TrustLoop is built around a latency-native multi-agent verification pipeline.

A normal RAG assistant retrieves documents and generates an answer. TrustLoop adds a real-time verification loop before the final response is shown to the user.

The key architecture principle is:

> Run verification agents in parallel, not sequentially.

This allows TrustLoop to check factual support, citation quality, contradictions, and risk without making the product feel slow.

---

## 2. High-Level System Diagram

```txt
User Question
     |
     v
Frontend UI
     |
     v
Backend API
     |
     v
Document Retriever
     |
     v
Relevant Context Chunks
     |
     v
Primary Answer Agent
Gemma 4 on Cerebras
     |
     v
Draft Answer + Citations
     |
     v
Claim Extraction Agent
Gemma 4 on Cerebras
     |
     v
Structured Claims
     |
     +------------------------------------------------+
     |          Parallel Verification Agents           |
     |                                                |
     v             v              v             v
Factual       Citation       Contradiction     Risk
Support       Match          Agent             Agent
Agent         Agent
     |             |              |             |
     +-------------+--------------+-------------+
                         |
                         v
              Confidence Aggregator
                         |
                         v
              Final Answer Composer
                         |
                         v
              Verified Answer UI
```

---

## 3. Core Components

### 3.1 Frontend UI

The frontend should not look like a generic chatbot. It should look like a verification dashboard.

Main UI sections:

- Question input
- Verified answer panel
- Confidence score
- Risk badge
- Claim ledger
- Citation viewer
- Agent timeline
- Latency metrics

Recommended stack:

- Next.js
- React
- Tailwind CSS
- shadcn/ui

Fast alternative:

- Streamlit

---

### 3.2 Backend API

The backend owns:

- RAG retrieval
- LLM calls
- Parallel agent orchestration
- Confidence scoring
- Final response composition
- Latency tracking

Recommended stack:

- Python
- FastAPI
- `asyncio.gather()` for parallel verification

Example endpoint:

```txt
POST /api/ask
```

Request:

```json
{
  "question": "Can our support team upload customer financial documents into a third-party analytics tool for churn analysis?"
}
```

Response:

```json
{
  "answer": "...",
  "confidence": 87,
  "risk_level": "medium",
  "claims": [],
  "citations": [],
  "latency": {
    "generation_ms": 420,
    "claim_extraction_ms": 180,
    "verification_ms": 610,
    "total_ms": 1450
  }
}
```

---

### 3.3 Document Store

For the hackathon MVP, use a small local demo corpus.

Recommended structure:

```txt
data/
└── demo_corpus/
    ├── data_handling_policy.md
    ├── vendor_risk_policy.md
    ├── customer_support_playbook.md
    ├── data_retention_policy.md
    └── ai_usage_policy.md
```

Each document should include citation IDs.

Example:

```md
## DATA_POLICY_3.2: Encryption Requirements

Customer financial documents must be encrypted at rest and in transit before being processed by any third-party system.
```

This makes citation verification easier and cleaner in the demo.

---

### 3.4 Retriever

The retriever takes a user question and returns the most relevant document chunks.

MVP retrieval options:

- Chroma
- FAISS
- In-memory vector search
- Keyword retrieval fallback

Returned chunk format:

```json
{
  "citation_id": "DATA_POLICY_3.2",
  "document_title": "Data Handling Policy",
  "section_title": "Encryption Requirements",
  "text": "Customer financial documents must be encrypted at rest and in transit before being processed by any third-party system.",
  "score": 0.89
}
```

---

### 3.5 Primary Answer Agent

The Primary Answer Agent generates the first draft answer using retrieved context.

Model:

```txt
gemma-4-31b on Cerebras
```

Responsibilities:

- Answer the user’s question
- Use only retrieved context
- Cite every factual claim
- Avoid unsupported assumptions
- Return structured JSON

Prompt:

```txt
You are an enterprise compliance assistant.

Answer the user's question using only the provided document context.

Rules:
- Do not use outside knowledge.
- Cite every factual claim using citation IDs.
- If the documents do not contain enough information, say so.
- Keep the answer concise and business-friendly.

User question:
{question}

Document context:
{context}

Return JSON:
{
  "answer": "...",
  "citations": [
    {
      "claim": "...",
      "citation_id": "...",
      "source_title": "..."
    }
  ]
}
```

---

### 3.6 Claim Extraction Agent

The Claim Extraction Agent breaks the draft answer into atomic factual claims.

Input:

- Draft answer

Output:

```json
{
  "claims": [
    {
      "id": "claim_1",
      "text": "The analytics vendor must be approved by Vendor Risk."
    },
    {
      "id": "claim_2",
      "text": "Customer financial documents must be encrypted."
    }
  ]
}
```

Prompt:

```txt
Break the answer into atomic factual claims.

A factual claim is a statement that can be checked against the documents.

Answer:
{answer}

Return JSON:
{
  "claims": [
    {
      "id": "claim_1",
      "text": "..."
    }
  ]
}
```

---

### 3.7 Parallel Verification Agents

The verifier agents run at the same time.

Recommended implementation:

```python
results = await asyncio.gather(
    run_factual_support_agent(claims, context),
    run_citation_match_agent(claims, context),
    run_contradiction_agent(answer, context),
    run_skeptic_agent(answer, claims, context),
    run_risk_agent(question, answer, context)
)
```

---

### Agent 1: Factual Support Agent

Purpose:

- Checks whether each claim is supported by the retrieved context.

Output:

```json
{
  "claim_results": [
    {
      "claim_id": "claim_1",
      "status": "supported",
      "confidence": 0.94,
      "evidence": ["VENDOR_POLICY_1.4"],
      "explanation": "The vendor policy states that third-party analytics tools must be approved by Vendor Risk."
    }
  ]
}
```

---

### Agent 2: Citation Match Agent

Purpose:

- Checks whether the citation attached to a claim actually supports the claim.

Output:

```json
{
  "citation_results": [
    {
      "claim_id": "claim_1",
      "citation_id": "VENDOR_POLICY_1.4",
      "citation_strength": "strong",
      "explanation": "The citation directly states the vendor approval requirement."
    }
  ]
}
```

---

### Agent 3: Contradiction Agent

Purpose:

- Looks for source text that conflicts with the answer.

Output:

```json
{
  "contradictions": [
    {
      "claim_id": "claim_3",
      "severity": "medium",
      "contradicting_citation": "DATA_POLICY_4.1",
      "explanation": "The answer implies unrestricted upload, but the policy requires deletion within the approved retention window."
    }
  ]
}
```

---

### Agent 4: Skeptic Agent

Purpose:

- Acts like an adversarial enterprise reviewer.
- Finds overconfident claims, missing exceptions, and hidden risk.

Output:

```json
{
  "issues": [
    {
      "severity": "medium",
      "issue": "The answer does not mention raw customer identifier removal.",
      "related_claim": "claim_1",
      "recommended_fix": "State that raw customer identifiers must be removed before analytics processing."
    }
  ]
}
```

---

### Agent 5: Risk Agent

Purpose:

- Classifies the enterprise risk level of the answer.

Output:

```json
{
  "risk_level": "medium",
  "risk_reasons": [
    "The question involves customer financial documents.",
    "The workflow involves a third-party analytics vendor.",
    "Data handling, retention, and privacy restrictions apply."
  ],
  "human_review_required": false
}
```

---

## 4. Confidence Aggregator

The Confidence Aggregator combines verifier outputs into a score from 0 to 100.

Recommended deterministic approach for MVP:

```python
score = 100

for claim in claims:
    if claim["status"] == "unsupported":
        score -= 25
    elif claim["status"] == "partially_supported":
        score -= 10
    elif claim["status"] == "uncertain":
        score -= 15

for citation in citation_results:
    if citation["citation_strength"] == "weak":
        score -= 8
    elif citation["citation_strength"] == "none":
        score -= 15

if contradictions:
    score -= 20

if risk_level == "high":
    score -= 10

score = max(0, min(100, score))
```

This is better than letting the LLM invent the confidence score.

---

## 5. Final Answer Composer

The Final Answer Composer creates the polished answer shown to the user.

It should:

- Remove unsupported claims
- Add missing conditions
- Mention uncertainty
- Recommend human review when needed
- Preserve citations
- Keep the answer concise

---

## 6. Data Contracts

### 6.1 Claim Object

```json
{
  "id": "claim_1",
  "text": "The analytics vendor must be approved by Vendor Risk.",
  "status": "supported",
  "confidence": 0.94,
  "supporting_citations": ["VENDOR_POLICY_1.4"],
  "citation_strength": "strong",
  "risk_level": "medium",
  "verifier_notes": "The vendor policy directly supports this claim.",
  "suggested_correction": null
}
```

---

### 6.2 Final Response Object

```json
{
  "question": "Can our support team upload customer financial documents into a third-party analytics tool for churn analysis?",
  "answer": "Yes, but only if the third-party analytics tool is approved by Vendor Risk, the documents are encrypted, raw customer identifiers are removed, and the data is deleted within the approved retention window.",
  "overall_confidence": 87,
  "risk_level": "medium",
  "claims": [],
  "citations": [],
  "latency": {
    "answer_generation_ms": 420,
    "claim_extraction_ms": 180,
    "parallel_verification_ms": 610,
    "total_ms": 1450
  }
}
```

---

## 7. UI Architecture

Recommended page layout:

```txt
 -------------------------------------------------------------
| TrustLoop                                                   |
| Real-time verified enterprise answers                       |
 -------------------------------------------------------------
| Question: Can support upload customer financial docs...?    |
 -------------------------------------------------------------
| VERIFIED ANSWER                  | AGENT TIMELINE           |
| Confidence: 87%                  | Answer Agent      0.42s  |
| Risk: Medium                     | Claim Extractor   0.18s  |
|                                  | Citation Agent    0.51s  |
| Yes, but only if...              | Skeptic Agent     0.59s  |
|                                  | Risk Agent        0.44s  |
|                                  | Final Verifier    0.21s  |
 -------------------------------------------------------------
| CLAIM LEDGER                                                |
| Claim                       Status        Citation          |
| Vendor must be approved     Supported     Vendor Policy     |
| Encryption required         Supported     Data Policy       |
| Raw IDs may be uploaded     Unsupported   No citation       |
| Retention limit applies     Supported     Retention Policy  |
 -------------------------------------------------------------
| LATENCY                                                     |
| 6 agents | 8 claims checked | 13 citations verified | 1.4s |
 -------------------------------------------------------------
```

---

## 8. Recommended Folder Structure

```txt
trustloop/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DEMO_SCRIPT.md
│   └── IMPLEMENTATION.md
├── frontend/
├── backend/
│   ├── app.py
│   ├── agents/
│   │   ├── answer_agent.py
│   │   ├── claim_extractor.py
│   │   ├── factual_support_agent.py
│   │   ├── citation_match_agent.py
│   │   ├── contradiction_agent.py
│   │   ├── skeptic_agent.py
│   │   └── risk_agent.py
│   ├── retrieval/
│   │   ├── loader.py
│   │   ├── chunker.py
│   │   └── retriever.py
│   └── scoring/
│       └── confidence.py
├── data/
│   └── demo_corpus/
└── scripts/
```