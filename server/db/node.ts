// Local SQLite for the node preset (never runs on Workers). drizzle/
// migrations auto-apply on first use.
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
    // Cascades (user -> level -> report) and the counter triggers depend
    // on it. D1 can't rely on PRAGMA state, so level deletes also remove
    // reports explicitly.
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
  // Per-request wrapper so the timing badge counts only this request's
  // queries; the client underneath stays shared.
  if (event) return drizzle(getNodeClient(), { schema, logger: dbLogger(event) });
  if (!db) db = drizzle(getNodeClient(), { schema });
  return db;
}
