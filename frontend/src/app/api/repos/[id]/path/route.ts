import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUserRepo } from "@/lib/github";
import { resolveRepoPath } from "@/lib/verify-service";
import { hasDatabase } from "@/lib/db";

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

  const path = await resolveRepoPath(row);
  return NextResponse.json({ path, source: row.source });
}
