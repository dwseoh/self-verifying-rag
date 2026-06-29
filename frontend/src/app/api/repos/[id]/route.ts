import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { repositories } from "@drizzle/schema";
import { getDb, hasDatabase } from "@/lib/db";
import { getUserRepo, repoToClient } from "@/lib/github";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  const row = await getUserRepo(session.user.id, id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ repository: repoToClient(row) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  await db
    .delete(repositories)
    .where(and(eq(repositories.id, id), eq(repositories.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
