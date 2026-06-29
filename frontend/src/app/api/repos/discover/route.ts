import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const backend =
    process.env.TRUSTLOOP_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:8000";

  const res = await fetch(
    `${backend}/api/repos/discover?q=${encodeURIComponent(q)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json({ repos: [], error: await res.text() }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
