// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

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
    // cascades and the counter triggers depend on it
    client.pragma("foreign_keys = ON");
  }
  return client;
}

export function ensureNodeMigrated(): void {
  getNodeDb();
}

export function getNodeDb(event?: H3Event): BetterSQLite3Database<typeof schema> {
  if (!migrated) {
    migrated = true;
    if (!db) db = drizzle(getNodeClient(), { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
  }
  // per-request wrapper so the timing badge counts this request's queries
  if (event) return drizzle(getNodeClient(), { schema, logger: dbLogger(event) });
  if (!db) db = drizzle(getNodeClient(), { schema });
  return db;
}
