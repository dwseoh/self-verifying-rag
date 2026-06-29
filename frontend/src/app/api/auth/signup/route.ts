import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "@drizzle/schema";
import { getDb, hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured. Add Neon connection string to deploy." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const name = body.name?.toString().trim();
  const email = body.email?.toString().trim().toLowerCase();
  const password = body.password?.toString();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) are required." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, name: name || email.split("@")[0], passwordHash })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
