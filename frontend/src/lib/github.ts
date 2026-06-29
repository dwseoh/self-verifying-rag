import { eq, and, desc } from "drizzle-orm";
import { Octokit } from "@octokit/rest";
import { repositories, accounts } from "@drizzle/schema";
import { getDb } from "./db";

export async function getGitHubToken(userId: string): Promise<string | null> {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);
  return account?.access_token ?? null;
}

export async function getGitHubConnection(userId: string) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);
  if (!account?.access_token) {
    return { connected: false as const };
  }
  return {
    connected: true as const,
    providerAccountId: account.providerAccountId,
    scope: account.scope,
  };
}

export async function disconnectGitHub(userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .returning({ providerAccountId: accounts.providerAccountId });
  return result.length > 0;
}

export function octokitForToken(token: string) {
  return new Octokit({ auth: token });
}

export async function listGitHubRepos(userId: string) {
  const token = await getGitHubToken(userId);
  if (!token) return { repos: [], error: "Connect GitHub by signing in with GitHub OAuth." };

  const octokit = octokitForToken(token);
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    per_page: 100,
    sort: "updated",
  });

  return {
    repos: repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      defaultBranch: r.default_branch,
      private: r.private,
      htmlUrl: r.html_url,
    })),
  };
}

export async function ensureRepoWebhook(
  userId: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
): Promise<number | null> {
  const token = await getGitHubToken(userId);
  if (!token) return null;

  const octokit = octokitForToken(token);
  const { data: hooks } = await octokit.rest.repos.listWebhooks({ owner, repo });
  const existing = hooks.find((h) => h.config.url === webhookUrl);
  if (existing) return existing.id;

  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
    events: ["pull_request", "push"],
    active: true,
  });
  return data.id;
}

export async function postPrComment(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
) {
  const octokit = octokitForToken(token);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export async function setCommitStatus(
  token: string,
  owner: string,
  repo: string,
  sha: string,
  state: "pending" | "success" | "failure" | "error",
  description: string,
  targetUrl?: string,
) {
  const octokit = octokitForToken(token);
  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state,
    description,
    context: "trustloop/verify",
    target_url: targetUrl,
  });
}

export function repoToClient(row: typeof repositories.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    source: row.source as "local" | "github",
    path: row.localPath ?? row.githubFullName ?? "",
    localPath: row.localPath,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    githubFullName: row.githubFullName,
    githubUrl: row.githubFullName ? `https://github.com/${row.githubFullName}` : undefined,
    defaultBranch: row.defaultBranch,
    connectedAt: row.connectedAt.toISOString(),
  };
}

export async function getUserRepo(userId: string, repoId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.id, repoId), eq(repositories.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listUserRepos(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(repositories)
    .where(eq(repositories.userId, userId))
    .orderBy(desc(repositories.connectedAt));
  return rows.map(repoToClient);
}
