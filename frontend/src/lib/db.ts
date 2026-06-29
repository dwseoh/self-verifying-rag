import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@drizzle/schema";

const url = process.env.DATABASE_URL;

export function hasDatabase(): boolean {
  return Boolean(url);
}

export function getDb() {
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;
