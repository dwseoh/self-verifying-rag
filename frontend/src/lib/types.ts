export type Severity = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type ScopeMode = "branch" | "unstaged" | "staged" | "paths";
export type RepoSource = "local" | "github";

export interface EvidenceSnippet {
  citation_id: string;
  text: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  explanation: string;
  citation_ids: string[];
  evidence_snippets: EvidenceSnippet[];
  related_paths: string[];
  recommended_fix: string | null;
  detected_by: string[];
  status: "open" | "acknowledged" | "dismissed";
}

export interface AgentTimelineEntry {
  agent: string;
  status: "ok" | "error";
  latency_ms: number;
  error: string | null;
}

export interface CorpusChunk {
  citation_id: string;
  document_title: string;
  section_title: string;
  text: string;
  score: number;
}

export interface LatencyBreakdown {
  indexing_ms: number;
  retrieval_ms: number;
  parallel_verification_ms: number;
  composition_ms: number;
  total_ms: number;
}

export interface RunMetadata {
  files_checked: number;
  citations_consulted: number;
  agents_run: number;
  corpus_max_score?: number;
}

export interface VerificationRun {
  id: string;
  trigger: string;
  repo_path: string;
  base_ref: string;
  head_ref: string;
  changed_paths: string[];
  findings: Finding[];
  risk_level: RiskLevel;
  overall_confidence: number;
  verification_incomplete: boolean;
  warnings: string[];
  agent_timeline: AgentTimelineEntry[];
  retrieved_chunks: CorpusChunk[];
  latency: LatencyBreakdown;
  metadata: RunMetadata;
}

export interface VerifyRequest {
  repo_path: string;
  changed_paths?: string[];
  base_ref?: string;
  head_ref?: string;
  trigger?: string;
  scope_mode?: ScopeMode;
  corpus_path?: string;
}

export interface Repository {
  id: string;
  name: string;
  source: RepoSource;
  path: string;
  githubUrl?: string;
  defaultBranch: string;
  connectedAt: string;
}

export interface WorkspaceSettings {
  cerebrasApiKey: string;
  apiKeyVerified: boolean;
  apiKeyLastChecked: string | null;
  backendUrl: string;
  repositories: Repository[];
}

export interface RepoIndexResponse {
  repo_path: string;
  is_git: boolean;
  graph: {
    nodes: number;
    edges: number;
    cached_files: number;
    python_files: number;
    c_cpp_files: number;
  };
  corpus: {
    path: string;
    auto_discovered: boolean;
    section_count: number;
    documents: Array<{
      document: string;
      sections: Array<{ citation_id: string; section_title: string; text_preview: string }>;
    }>;
  };
}

export interface StoredRun {
  id: string;
  repoId: string;
  scopeMode: ScopeMode;
  baseRef: string;
  headRef: string;
  startedAt: string;
  result: VerificationRun;
}

export interface McpConfigResponse {
  server_name: string;
  command: string;
  args: string[];
  cwd: string;
  install: string;
  run_script: string;
  default_repo_path: string;
  tools: Array<{ name: string; description: string }>;
  cursor_config_json: Record<string, unknown>;
  cursor_config_path: string;
}

export interface AddRuleRequest {
  repo_path: string;
  citation_id: string;
  section_title: string;
  body: string;
  filename?: string;
}

export interface HealthResponse {
  status: string;
  mock_mode: boolean;
  llm_mode: string;
  model: string;
}

export type PipelineStepId = "index" | "scope" | "rules" | "agents" | "compose";
export type PipelineStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
  ms?: number;
}
