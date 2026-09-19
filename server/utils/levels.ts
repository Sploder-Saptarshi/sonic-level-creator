// server/utils/levels.ts — session-scoped level storage helpers (API + pages).
// One drizzle handle per request: D1 on the edge, local SQLite on node.
//
// Query/row budgets (D1 bills rows_read — every helper below is minimal):
//   requireUser            0-1 reads (0 without cookie, 1 session row with)
//   readLevelBody          0 SQL (pure validation, fails before any write)
//   requireRow             0 SQL (folds a 404 check onto an existing result)
//   listMyLevels           1 query, metadata-only columns (never `data`),
//                          N rows for N owned levels over the userId index
//   listPublicLevels       1 query, published-only metadata + author over
//                          the published index (stock row excluded in SQL)
//   findVisibleLevelName   1 query, 1 row, name + published only (PK + visibility)
//   findGatewayRow         1 query, 1 row, data/published/userId only
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { level, user } from "../db/schema";
import { first, getSessionUser, type SessionUser } from "./session";

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
  const s = first(v);
  if (typeof s !== "string") return null;
  const name = s.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export function cleanDims(v: unknown): number | null {
  const n = Number(first(v));
  return Number.isInteger(n) && n >= 1 && n <= 256 ? n : null;
}

export function cleanLevelData(v: unknown): string | null {
  const s = first(v);
  // CSV text; 1MB cap keeps a single level well under D1 row limits.
  return typeof s === "string" && s.length <= 1_000_000 ? s : null;
}

export interface LevelBody {
  name: string;
  cols: number;
  rows: number;
  data: string;
}

// Validate a create/update payload. 0 SQL: throws 400 before any DB
// round-trip. Shared by POST /api/levels and PUT /api/levels/:id (was a
// verbatim 10-line clone in both handlers).
export function readLevelBody(body: Record<string, unknown>): LevelBody {
  const name = cleanLevelName(body?.name);
  const cols = cleanDims(body?.cols);
  const rows = cleanDims(body?.rows);
  const data = cleanLevelData(body?.data ?? "");
  if (!name || !cols || !rows || data === null) {
    throw new HTTPError({
      status: 400,
      message: "Need name (1–60 chars), cols/rows (1–256), data (≤1MB).",
    });
  }
  return { name, cols, rows, data };
}

// Fold an existence check onto an already-fetched result: 0 extra SQL.
// Shared by the [id] GET/PUT/DELETE/publish handlers (was a 3-line clone).
export function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return row;
}

// Level id from a form/body/router value: non-empty string <= 128 chars.
// Shared by the mylevels delete form and API routes.
export function cleanId(v: unknown): string | null {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 128 ? s : null;
}

export function levelWhere(id: string, userId: string) {
  return and(eq(level.id, id), eq(level.userId, userId));
}

type RequestDb = ReturnType<typeof getNodeDb>;

// Seeded stock Green Hill row: the default playable level (also the
// archive DEFAULT_LEVEL_ID). Playable via / and the gateway, but never
// listed in All Levels and /play/2914 redirects home.
export const STOCK_LEVEL_ID = "2914";

// The signed-in user's levels, metadata only (never the ~MB `data`
// column): exactly 1 query over the userId index. Shared by
// GET /api/levels and GET /editors/mylevels (params pick the column set).
export function listMyLevels(db: RequestDb, userId: string, withPublished: true): Promise<Array<{ id: string; name: string; cols: number; rows: number; published: boolean | null; updatedAt: Date }>>;
export function listMyLevels(db: RequestDb, userId: string, withPublished?: false): Promise<Array<{ id: string; name: string; cols: number; rows: number; updatedAt: Date }>>;
export function listMyLevels(db: RequestDb, userId: string, withPublished?: boolean): Promise<any[]> {
  // Two explicit branches: drizzle's select() typing rejects a
  // conditionally-shaped columns object.
  if (withPublished) {
    return db
      .select({
        id: level.id,
        name: level.name,
        cols: level.cols,
        rows: level.rows,
        published: level.published,
        updatedAt: level.updatedAt,
      })
      .from(level)
      .where(eq(level.userId, userId))
      .orderBy(desc(level.updatedAt));
  }
  return db
    .select({
      id: level.id,
      name: level.name,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .where(eq(level.userId, userId))
    .orderBy(desc(level.updatedAt));
}

// Published directory, metadata + author, stock excluded in SQL:
// exactly 1 query over the published index. `data` is never selected.
export function listPublicLevels(db: RequestDb) {
  return db
    .select({
      id: level.id,
      name: level.name,
      author: user.username,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID)))
    .orderBy(desc(level.updatedAt));
}

// Player lookup: exactly 1 query reading exactly 1 row (name + published
// columns only) via PK + visibility predicate. Published rows serve
// everyone; owners additionally see their own unpublished rows.
export function findVisibleLevelName(
  db: RequestDb,
  id: string,
  session: SessionUser | null,
) {
  const visible = session
    ? or(eq(level.published, true), eq(level.userId, session.id))
    : eq(level.published, true);
  return db
    .select({ name: level.name, published: level.published })
    .from(level)
    .where(and(eq(level.id, id), visible));
}

export interface GatewayRow {
  data: string;
  published: boolean | null;
  userId: string;
}

// Gateway lookup: exactly 1 query reading exactly 1 row (PK), fetching
// only the columns the visibility check + byte encoder need.
export function findGatewayRow(db: RequestDb, id: string) {
  return db
    .select({ data: level.data, published: level.published, userId: level.userId })
    .from(level)
    .where(eq(level.id, id));
}