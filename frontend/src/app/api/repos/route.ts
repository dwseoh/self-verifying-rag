import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { repositories } from "@drizzle/schema";
import { getDb, hasDatabase } from "@/lib/db";
import {
  ensureRepoWebhook,
  listUserRepos,
  repoToClient,
} from "@/lib/github";

function requireDb() {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ repositories: [], offline: true });
  }

  const repos = await listUserRepos(session.user.id);
  return NextResponse.json({ repositories: repos });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  requireDb();
  const body = await request.json();
  const db = getDb();

  if (body.source === "github") {
    const owner = body.githubOwner?.toString();
    const repoName = body.githubRepo?.toString();
    const fullName = body.githubFullName?.toString() ?? `${owner}/${repoName}`;
    if (!owner || !repoName) {
      return NextResponse.json({ error: "githubOwner and githubRepo required" }, { status: 400 });
    }

    const webhookUrl = process.env.TRUSTLOOP_WEBHOOK_URL;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    let webhookId: number | null = null;
    if (webhookUrl && webhookSecret) {
      webhookId = await ensureRepoWebhook(
        session.user.id,
        owner,
        repoName,
        webhookUrl,
        webhookSecret,
      );
    }

    const [row] = await db
      .insert(repositories)
      .values({
        userId: session.user.id,
        name: body.name?.toString() || repoName,
        source: "github",
        githubOwner: owner,
        githubRepo: repoName,
        githubFullName: fullName,
        defaultBranch: body.defaultBranch?.toString() || "main",
        webhookId: webhookId ?? undefined,
      })
      .returning();

    return NextResponse.json({ repository: repoToClient(row) }, { status: 201 });
  }

  const localPath = body.localPath?.toString().trim() || body.path?.toString().trim();
  if (!localPath) {
    return NextResponse.json({ error: "localPath is required for local repos" }, { status: 400 });
  }

  const [row] = await db
    .insert(repositories)
    .values({
      userId: session.user.id,
      name: body.name?.toString() || localPath.split("/").pop() || "Repository",
      source: "local",
      localPath,
      defaultBranch: body.defaultBranch?.toString() || "main",
    })
    .returning();

  return NextResponse.json({ repository: repoToClient(row) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  requireDb();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  await db
    .delete(repositories)
    .where(and(eq(repositories.id, id), eq(repositories.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
