// server/utils/levels.ts — session-scoped level storage helpers (API + pages).
// One drizzle handle per request: D1 on the edge, local SQLite on node.
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { level } from "../db/schema";
import { getSessionUser, type SessionUser } from "./session";

export function getRequestDb(event: H3Event): ReturnType<typeof getNodeDb> {
  const env = getAuthEnv(event);
  if (env.kind === "d1") {
    // Same sqlite query-builder surface as better-sqlite3 for basic CRUD.
    return drizzleD1(env.d1!, { schema: { level } }) as unknown as ReturnType<
      typeof getNodeDb
    >;
  }
  return getNodeDb();
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event);
  if (!user) throw new HTTPError({ status: 401, message: "Sign in required" });
  return user;
}

export function cleanLevelName(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") return null;
  const name = s.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export function cleanDims(v: unknown): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 && n <= 256 ? n : null;
}

export function cleanLevelData(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  // CSV text; 1MB cap keeps a single level well under D1 row limits.
  return typeof s === "string" && s.length <= 1_000_000 ? s : null;
}

export function levelWhere(id: string, userId: string) {
  return and(eq(level.id, id), eq(level.userId, userId));
}
