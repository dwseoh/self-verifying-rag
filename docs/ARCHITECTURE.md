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
                         |
                         v
        Document Improvement Suggestions
                         |
                         v
              Human Reviewer Approval
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
- Document improvement suggestions
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
- Document gap detection
- Suggested document update generation
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
  "document_gaps": [],
  "suggested_document_updates": [],
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

## 6. Human-in-the-Loop Learning Layer

The Human-in-the-Loop Learning Layer turns verification failures into reviewable document improvement suggestions.

For the 24-hour MVP, this layer should be lightweight. It should show a small panel of suggested improvements, explain why each suggestion was generated, and make clear that no source document is updated automatically.

Future versions can connect approved updates to a document management system, version control workflow, or enterprise knowledge base.

### 6.1 Learning Flow

```txt
Answer Verification
        |
        v
Gap Detection
        |
        v
Suggested Document Update
        |
        v
Human Review
        |
        v
Approved Knowledge Base Update
```

### 6.2 Gap Detection Inputs

The gap detector can consume outputs from the existing verifier agents.

Example triggers:

- Unsupported claim
- Weak or missing citation
- Contradiction between documents
- Missing policy coverage
- Ambiguous source text
- Missing exception, approval path, or risk condition

### 6.3 MVP Behavior

The MVP does not need a full workflow engine.

Recommended behavior:

- Generate 1-3 suggested document improvements from verifier findings.
- Display each suggestion in the UI with source evidence.
- Mark each suggestion as pending review.
- Optionally support simple approve/reject buttons backed by local state.
- Include approved or rejected suggestions in the audit trail.

### 6.4 Non-MVP Behavior

The MVP should not:

- Automatically edit source documents
- Sync approved changes into production systems
- Implement full document versioning
- Implement enterprise approval routing

---

## 7. Data Contracts

Parallel agents require clear data contracts so different team members can build modules independently and mount them together at the API boundary. Each agent should accept and return predictable JSON, even if the implementation behind it changes during the hackathon.

### 7.1 Claim Object

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

### 7.2 Final Response Object

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
  },
  "document_gaps": [],
  "suggested_document_updates": []
}
```

---

### 7.3 DocumentGap

```json
{
  "id": "gap_1",
  "type": "missing_policy_coverage",
  "severity": "medium",
  "related_claim_id": "claim_3",
  "question": "Can support upload customer financial documents into a third-party analytics tool?",
  "source_citations": ["DATA_POLICY_3.2", "VENDOR_POLICY_1.4"],
  "description": "The retrieved policies explain encryption and vendor approval but do not clearly state whether churn analysis is an allowed purpose.",
  "detected_by": ["skeptic_agent", "factual_support_agent"],
  "confidence": 0.78
}
```

---

### 7.4 SuggestedDocumentUpdate

```json
{
  "id": "suggestion_1",
  "gap_id": "gap_1",
  "target_document": "Customer Support Playbook",
  "target_section": "Third-Party Analytics Requests",
  "suggested_text": "Clarify that customer financial documents may be used for churn analysis only when the analytics vendor is approved, encryption is enabled, raw customer identifiers are removed, and retention limits are followed.",
  "reason": "Verification found that the answer required conditions spread across multiple policies, but the support playbook does not state the complete workflow.",
  "status": "pending_review",
  "priority": "medium",
  "created_from_answer_id": "answer_123"
}
```

---

### 7.5 HumanReviewDecision

```json
{
  "id": "review_1",
  "suggested_update_id": "suggestion_1",
  "decision": "approved",
  "reviewer": "knowledge_manager_demo",
  "reviewed_at": "2026-06-28T15:30:00Z",
  "review_notes": "Approved for demo corpus update.",
  "approved_text": "Customer financial documents may be used for churn analysis only when the analytics vendor is approved, encryption is enabled, raw customer identifiers are removed, and retention limits are followed."
}
```

---

## 8. UI Architecture

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
| DOCUMENT IMPROVEMENT SUGGESTIONS                            |
| Gap: Support playbook does not state analytics conditions    |
| Suggestion: Add approval, encryption, de-ID, retention rules |
| Status: Pending human review                                |
 -------------------------------------------------------------
| LATENCY                                                     |
| 6 agents | 8 claims checked | 13 citations verified | 1.4s |
 -------------------------------------------------------------
```

---

## 9. Recommended Folder Structure

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
│   ├── improvement/
│   │   ├── gap_detector.py
│   │   ├── suggestion_generator.py
│   │   └── review_store.py
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

---

## 10. Future MCP / Coding Assurance Architecture

This section is future architecture and stretch direction. It is not required for the 24-hour MVP.

The same TrustLoop pattern can extend from enterprise policy documents to codebases. In that mode, TrustLoop acts as an assurance layer for engineering workflows: it maps the repository, reads architecture documentation, answers implementation questions, verifies code changes against requirements, and suggests documentation updates for human review.

### 10.1 Future System Diagram

```txt
Repository Connection
        |
        v
Codebase Parser
        |
        v
Architecture Mapper
        |
        +--------------------+
        |                    |
        v                    v
Dependency Graph      Documentation Index
        |                    |
        +----------+---------+
                   |
                   v
          Documentation Matcher
                   |
                   v
          Code-Change Verifier
                   |
                   v
            MCP Tool Interface
                   |
                   v
Cursor / Claude Code / MCP-Compatible Workflow
```

### 10.2 Future Components

- **Codebase Parser:** Reads repository files, module boundaries, service definitions, API surfaces, and configuration.
- **Architecture Mapper:** Builds a structured view of services, ownership, data flow, and major dependencies.
- **Dependency Graph:** Tracks imports, package dependencies, service calls, and related files.
- **Documentation Matcher:** Compares implementation against README files, architecture docs, requirements, and runbooks.
- **Code-Change Verifier:** Reviews diffs or pull requests to flag changes that may violate expected architecture, policy, or requirements.
- **MCP Tool Interface:** Exposes TrustLoop checks inside developer tools such as Cursor, Claude Code, or other MCP-compatible workflows.

### 10.3 Future Workflow

1. Connect to a repository.
2. Map files, services, APIs, dependencies, and ownership.
3. Answer architecture questions with citations to docs and code.
4. Verify whether implementation matches documentation.
5. Flag risky code changes.
6. Suggest documentation updates.
7. Send suggestions to human review before any document changes are applied.

---

## 11. Parallel Development Plan

The architecture is intentionally modular so the team can work in parallel during the hackathon.

### RAG + Retrieval

Owner focus:

- Build the demo corpus loader.
- Add chunking and citation IDs.
- Implement vector or keyword retrieval.
- Return consistent chunk objects to the answer agent.

### Verifier Agents

Owner focus:

- Implement factual support, citation match, contradiction, skeptic, and risk agents.
- Keep each agent behind a stable JSON input/output contract.
- Return partial results if one agent fails.

### Frontend Dashboard

Owner focus:

- Build the question input, verified answer panel, confidence score, claim ledger, citation viewer, agent timeline, latency panel, and document improvement suggestions panel.
- Make the UI feel like an enterprise verification dashboard, not a generic chatbot.

### Data Contracts

Owner focus:

- Define shared TypeScript or Python models for claims, citations, verifier results, document gaps, suggested updates, review decisions, and final responses.
- Keep sample JSON fixtures available for frontend and backend work before the full pipeline is connected.

### Document Improvement Suggestions

Owner focus:

- Convert verifier findings into `DocumentGap` objects.
- Generate `SuggestedDocumentUpdate` objects.
- Store review decisions locally for the demo.
- Make clear that human approval is required.

### Demo Polish

Owner focus:

- Prepare the Northstar Bank scenario.
- Add seeded examples for standard RAG versus TrustLoop.
- Ensure latency metrics and parallel agent activity are visible.
- Keep the story focused on real-time verification plus a credible documentation improvement loop.
