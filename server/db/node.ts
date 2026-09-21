// server/db/node.ts — local SQLite for the node preset (dev + self-host).
// D1 in production; this file never runs on Workers. Schema shared via
// server/db/schema.ts; drizzle/ migrations auto-apply on first use.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { H3Event } from "nitro";
import * as schema from "./schema";
import { dbLogger } from "../utils/timing";

const DB_PATH = process.env.AUTH_DB_PATH ?? "./data/auth.db";

let client: Database.Database | null = null;
let db: BetterSQLite3Database<typeof schema> | null = null;
let migrated = false;

export function getNodeClient(): Database.Database {
  if (!client) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    client = new Database(DB_PATH);
    client.pragma("journal_mode = WAL");
    // better-sqlite3 currently defaults foreign_keys ON, but pin it: the
    // ON DELETE CASCADE clauses in drizzle/* (user -> level -> report)
    // only mean anything with enforcement on. Without it, deletes silently
    // orphan rows and the counter triggers never see the cascaded deletes.
    // D1 cannot rely on per-connection PRAGMA state, so level deletes
    // additionally remove their reports explicitly in application code
    // (see the delete handlers) — belt and suspenders, harmless when
    // cascades do fire.
    client.pragma("foreign_keys = ON");
  }
  return client;
}

export function ensureNodeMigrated(): void {
  if (migrated) return;
  migrated = true;
  getNodeDb();
}

export function getNodeDb(event?: H3Event): BetterSQLite3Database<typeof schema> {
  if (!migrated) {
    migrated = true;
    if (!db) db = drizzle(getNodeClient(), { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
  }
  // Per-request wrapper when the caller carries a timing context, so the
  // badge counts exactly this request's statements (a cached wrapper
  // would pin the first request's logger forever). Wrapper construction
  // is cheap; the SQLite client underneath stays shared.
  if (event) return drizzle(getNodeClient(), { schema, logger: dbLogger(event) });
  if (!db) db = drizzle(getNodeClient(), { schema });
  return db;
}
