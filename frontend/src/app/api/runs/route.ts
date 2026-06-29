import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { verificationRuns } from "@drizzle/schema";
import { getDb, hasDatabase } from "@/lib/db";
import { getUserRepo } from "@/lib/github";
import { runVerificationForRepo } from "@/lib/verify-service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ runs: [] });
  }

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");
  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId required" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(verificationRuns)
    .where(
      and(
        eq(verificationRuns.repositoryId, repositoryId),
        eq(verificationRuns.userId, session.user.id),
      ),
    )
    .orderBy(desc(verificationRuns.startedAt))
    .limit(50);

  return NextResponse.json({
    runs: rows.map((r) => ({
      id: r.id,
      repoId: r.repositoryId,
      scopeMode: r.scopeMode,
      baseRef: r.baseRef ?? "",
      headRef: r.headRef ?? "",
      startedAt: r.startedAt.toISOString(),
      status: r.status,
      prNumber: r.prNumber,
      prUrl: r.prUrl,
      result: r.result,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await request.json();
  const repositoryId = body.repositoryId?.toString();
  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId required" }, { status: 400 });
  }

  const repo = await getUserRepo(session.user.id, repositoryId);
  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const run = await runVerificationForRepo({
    userId: session.user.id,
    repository: repo,
    scopeMode: body.scopeMode ?? "branch",
    baseRef: body.baseRef ?? repo.defaultBranch,
    headRef: body.headRef ?? "HEAD",
    changedPaths: body.changedPaths,
    snapshotPrefix: body.snapshotPrefix?.toString(),
    fixture: body.fixture,
    trigger: body.trigger ?? "manual",
    prNumber: body.prNumber,
    prUrl: body.prUrl,
  });

  return NextResponse.json({ run });
}
