import type { Repository, StoredRun } from "./types";

export async function fetchRepositories(): Promise<Repository[]> {
  const res = await fetch("/api/repos", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.offline) return [];
  return data.repositories ?? [];
}

export async function createRepository(body: Record<string, unknown>): Promise<Repository> {
  const res = await fetch("/api/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.repository;
}

export async function fetchRepository(id: string): Promise<Repository | null> {
  const res = await fetch(`/api/repos/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.repository;
}

export async function resolveRepositoryPath(id: string): Promise<string> {
  const res = await fetch(`/api/repos/${id}/path`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.path as string;
}

export async function discoverLocalRepos(query: string): Promise<
  Array<{ name: string; path: string; default_branch: string }>
> {
  const res = await fetch(`/api/repos/discover?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.repos ?? [];
}

export async function fetchGitHubRepos(): Promise<
  Array<{
    id: number;
    fullName: string;
    name: string;
    owner: string;
    defaultBranch: string;
    htmlUrl: string;
  }>
> {
  const res = await fetch("/api/github/repos", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.repos ?? [];
}

export async function fetchRuns(repositoryId: string): Promise<StoredRun[]> {
  const res = await fetch(`/api/runs?repositoryId=${repositoryId}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.runs ?? [];
}

export async function startRun(body: Record<string, unknown>): Promise<StoredRun> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.run;
}

export async function fetchMcpConfigSaas(repoPath: string) {
  const qs = new URLSearchParams({ repo_path: repoPath });
  const res = await fetch(`/api/mcp/config?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("MCP config fetch failed");
  return res.json();
}
