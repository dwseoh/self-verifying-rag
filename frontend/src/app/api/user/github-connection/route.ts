import { auth } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { disconnectGitHub, getGitHubConnection } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauthConfigured = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

  if (!hasDatabase()) {
    return NextResponse.json({
      oauthConfigured,
      connected: false,
      error: "Database not configured",
    });
  }

  const connection = await getGitHubConnection(session.user.id);
  return NextResponse.json({
    oauthConfigured,
    ...connection,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const removed = await disconnectGitHub(session.user.id);
  return NextResponse.json({ ok: true, removed });
}
