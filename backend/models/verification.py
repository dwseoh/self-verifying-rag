from enum import Enum
from typing import Literal

from typing import Literal

from pydantic import BaseModel, Field


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TriggerType(str, Enum):
    MANUAL = "manual"
    SAVE = "save"
    COMMIT = "commit"
    PR = "pr"
    TEST_FAILURE = "test_failure"
    FACT_CONFIRM = "fact_confirm"


class EvidenceSnippet(BaseModel):
    citation_id: str
    text: str


class Finding(BaseModel):
    id: str
    severity: Severity
    confidence: int = Field(ge=0, le=100)
    title: str
    explanation: str
    citation_ids: list[str] = Field(default_factory=list)
    evidence_snippets: list[EvidenceSnippet] = Field(default_factory=list)
    related_paths: list[str] = Field(default_factory=list)
    recommended_fix: str | None = None
    detected_by: list[str] = Field(default_factory=list)
    status: Literal["open", "acknowledged", "dismissed"] = "open"


class AgentTimelineEntry(BaseModel):
    agent: str
    status: Literal["ok", "error"]
    latency_ms: int
    error: str | None = None


class LatencyBreakdown(BaseModel):
    indexing_ms: int = 0
    retrieval_ms: int = 0
    parallel_verification_ms: int = 0
    composition_ms: int = 0
    total_ms: int = 0


class RunMetadata(BaseModel):
    files_checked: int = 0
    citations_consulted: int = 0
    agents_run: int = 0
    corpus_max_score: float = 0.0


class CorpusChunk(BaseModel):
    citation_id: str
    document_title: str
    section_title: str
    text: str
    score: float = 0.0


class VerifyRequest(BaseModel):
    repo_path: str | None = None
    base_ref: str = "main"
    head_ref: str = "HEAD"
    changed_paths: list[str] = Field(default_factory=list)
    trigger: TriggerType = TriggerType.MANUAL
    diff_summary: str | None = None
    test_context: str | None = None
    corpus_path: str | None = None
    scope_mode: Literal["branch", "unstaged", "staged", "paths"] = "branch"


class VerificationRun(BaseModel):
    id: str
    trigger: TriggerType
    repo_path: str
    base_ref: str = "main"
    head_ref: str = "HEAD"
    changed_paths: list[str] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high"] = "low"
    overall_confidence: int = Field(default=100, ge=0, le=100)
    verification_incomplete: bool = False
    warnings: list[str] = Field(default_factory=list)
    agent_timeline: list[AgentTimelineEntry] = Field(default_factory=list)
    retrieved_chunks: list[CorpusChunk] = Field(default_factory=list)
    latency: LatencyBreakdown = Field(default_factory=LatencyBreakdown)
    metadata: RunMetadata = Field(default_factory=RunMetadata)


class AgentResult(BaseModel):
    agent: str
    status: Literal["ok", "error"] = "ok"
    latency_ms: int = 0
    findings: list[Finding] = Field(default_factory=list)
    error: str | None = None


class AddRuleRequest(BaseModel):
    repo_path: str
    citation_id: str = Field(min_length=3, max_length=64)
    section_title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    filename: str = "custom_rules.md"
