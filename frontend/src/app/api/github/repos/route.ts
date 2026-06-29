import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listGitHubRepos } from "@/lib/github";
import { hasDatabase } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ repos: [], error: "Database not configured" });
  }

  const result = await listGitHubRepos(session.user.id);
  return NextResponse.json(result);
}
