// server/db/node.ts — local SQLite for the node preset (dev + self-host).
// D1 in production; this file never runs on Workers. Schema shared via
// server/db/schema.ts; drizzle/ migrations auto-apply on first use.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.AUTH_DB_PATH ?? "./data/auth.db";

let client: Database.Database | null = null;
let db: BetterSQLite3Database<typeof schema> | null = null;
let migrated = false;

export function getNodeClient(): Database.Database {
  if (!client) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    client = new Database(DB_PATH);
    client.pragma("journal_mode = WAL");
  }
  return client;
}

export function ensureNodeMigrated(): void {
  if (migrated) return;
  migrated = true;
  getNodeDb();
}

export function getNodeDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    db = drizzle(getNodeClient(), { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
  }
  return db;
}
