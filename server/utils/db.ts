// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import type { H3Event } from "nitro";
import type { D1Database, D1DatabaseSession } from "@cloudflare/workers-types";
import { getAuthEnv, getNodeDb } from "../auth/env";
import * as schema from "../db/schema";
import { getReplicaSession, readBookmark } from "./replica";
import { dbLogger } from "./timing";

// D1 and better-sqlite3 share drizzle's SQLite query builder.
export type Db = ReturnType<typeof getNodeDb>;

function d1Db(event: H3Event, binding: D1Database | D1DatabaseSession): Db {
  return drizzleD1(binding as D1Database, { schema, logger: dbLogger(event) }) as unknown as Db;
}

export function getRequestDb(event: H3Event): Db {
  const { d1 } = getAuthEnv(event);
  return d1 ? d1Db(event, d1) : getNodeDb(event);
}

export function openReplica(event: H3Event): { db: Db; replica: D1DatabaseSession | null } {
  const replica = getReplicaSession(event, readBookmark(event));
  return { db: replica ? d1Db(event, replica) : getRequestDb(event), replica };
}

export function getReplicaDb(event: H3Event): Db {
  return openReplica(event).db;
}
