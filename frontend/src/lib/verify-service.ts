import crypto from "crypto";
import { eq } from "drizzle-orm";
import { verificationRuns, repositories } from "@drizzle/schema";
import { getDb } from "./db";
import type { repositories as RepositoriesTable } from "@drizzle/schema";

type RepoRow = typeof RepositoriesTable.$inferSelect;

function backendUrl() {
  return (
    process.env.TRUSTLOOP_BACKEND_URL ||
    process.env.TRUSTLOOP_API_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

export async function resolveRepoPath(repo: RepoRow): Promise<string> {
  if (repo.source === "local" && repo.localPath) {
    return repo.localPath;
  }

  if (repo.source === "github" && repo.githubFullName) {
    const res = await fetch(`${backendUrl()}/api/github/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: repo.githubFullName,
        default_branch: repo.defaultBranch,
        repository_id: repo.id,
      }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();
    return data.path as string;
  }

  throw new Error("Repository has no resolvable path");
}

export async function runVerificationForRepo(opts: {
  userId: string;
  repository: RepoRow;
  scopeMode?: string;
  baseRef?: string;
  headRef?: string;
  changedPaths?: string[];
  fixture?: "clean" | "violation";
  trigger?: string;
  prNumber?: number;
  prUrl?: string;
}) {
  const db = getDb();
  const runId = `run_${crypto.randomUUID().slice(0, 12)}`;
  const scopeMode = opts.scopeMode ?? "branch";
  const baseRef = opts.baseRef ?? opts.repository.defaultBranch;
  const headRef = opts.headRef ?? "HEAD";

  await db.insert(verificationRuns).values({
    id: runId,
    repositoryId: opts.repository.id,
    userId: opts.userId,
    trigger: opts.trigger ?? "manual",
    scopeMode,
    baseRef,
    headRef,
    status: "running",
    prNumber: opts.prNumber,
    prUrl: opts.prUrl,
  });

  try {
    const repoPath = await resolveRepoPath(opts.repository);
    const qs = opts.fixture ? `?fixture=${opts.fixture}` : "";
    const res = await fetch(`${backendUrl()}/api/verify${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo_path: repoPath,
        base_ref: baseRef,
        head_ref: headRef,
        scope_mode: scopeMode,
        changed_paths: opts.changedPaths,
        trigger: opts.trigger ?? "manual",
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const result = await res.json();
    await db
      .update(verificationRuns)
      .set({
        status: "completed",
        result,
        riskLevel: result.risk_level,
        findingsCount: result.findings?.length ?? 0,
        completedAt: new Date(),
      })
      .where(eq(verificationRuns.id, runId));

    return {
      id: runId,
      repoId: opts.repository.id,
      scopeMode,
      baseRef,
      headRef,
      startedAt: new Date().toISOString(),
      status: "completed" as const,
      result,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed";
    await db
      .update(verificationRuns)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(eq(verificationRuns.id, runId));
    throw e;
  }
}

export async function findRepoByGitHubFullName(fullName: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.githubFullName, fullName))
    .limit(1);
  return row ?? null;
}
