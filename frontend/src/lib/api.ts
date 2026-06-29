import type {
  AddRuleRequest,
  HealthResponse,
  McpConfigResponse,
  RepoIndexResponse,
  VerificationRun,
  VerifyRequest,
} from "./types";

export async function fetchHealth(baseUrl: string): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend offline (${res.status})`);
  return res.json();
}

export async function testLlmConnection(baseUrl: string): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${baseUrl}/health/llm`, { cache: "no-store" });
  const data = await res.json();
  if (data.status === "ok") return { status: "ok" };
  return { status: "error", error: data.error ?? "LLM check failed" };
}

export async function fetchRepoIndex(baseUrl: string, repoPath: string): Promise<RepoIndexResponse> {
  const qs = new URLSearchParams({ repo_path: repoPath });
  const res = await fetch(`${baseUrl}/api/repos/index?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Index fetch failed (${res.status})`);
  return res.json();
}

export async function fetchPreview(baseUrl: string, body: VerifyRequest): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/api/verify/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, trigger: "manual" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runVerification(
  baseUrl: string,
  body: VerifyRequest,
  options?: { fixture?: "clean" | "violation" },
): Promise<VerificationRun> {
  const qs = options?.fixture ? `?fixture=${options.fixture}` : "";
  const res = await fetch(`${baseUrl}/api/verify${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, trigger: body.trigger ?? "manual" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchFixture(
  baseUrl: string,
  kind: "clean" | "violation",
): Promise<VerificationRun> {
  const res = await fetch(`${baseUrl}/api/schema/fixture`, { cache: "no-store" });
  if (!res.ok) throw new Error("Fixture fetch failed");
  const data = await res.json();
  return data[kind];
}

export async function fetchMcpConfig(
  baseUrl: string,
  repoPath: string,
): Promise<McpConfigResponse> {
  const qs = new URLSearchParams({ repo_path: repoPath });
  const res = await fetch(`${baseUrl}/api/mcp/config?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("MCP config fetch failed");
  return res.json();
}

export async function addRule(
  baseUrl: string,
  body: AddRuleRequest,
): Promise<{ path: string; citation_id: string; corpus_path: string }> {
  const res = await fetch(`${baseUrl}/api/repos/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
