// server/utils/levels.ts — session-scoped level storage helpers (API + pages).
// One drizzle handle per request: D1 on the edge, local SQLite on node.
//
// Query/row budgets (D1 bills rows_read — every helper below is minimal):
//   requireUser            0-1 reads (0 without cookie, 1 session row with)
//   readLevelBody          0 SQL (pure validation, fails before any write)
//   requireRow             0 SQL (folds a 404 check onto an existing result)
//   listMyLevels           1 query, metadata-only columns (never `data`),
//                          N rows for N owned levels over the userId index
//   listPublicLevels       1 query, one page of published metadata + author
//                          over the published index (LIMIT/OFFSET in SQL)
//   countPublicLevels      1 aggregate query, total published rows (no rows)
//   listMyLevelsPage       1 query, one page of owned metadata (never `data`)
//   countMyLevels          1 aggregate query, total owned rows (no rows)
//   listPublicLevelsByUserId 1 query, one page of published metadata +
//                          author over the userId index (LIMIT/OFFSET in SQL)
//   countPublicLevelsByUserId 1 aggregate query, total rows for one
//                          creator (no rows)
//   findUserById           1 query, 1 row, id + username only (PK;
//                          empty per-user pages only, to 404 unknown ids)
//   findVisibleLevelName   1 query, 1 row, name + published only (PK + visibility)
//   findReportedLevelName  1 query, <= 1 row, name + published only (PK +
//                          one open-report join; moderator fallback only)
//   hasOpenReport          1 query, <= 1 row, report id only (levelId +
//                          status probe; gateway moderator fallback only)
//   findGatewayRow         1 query, 1 row, data/name/published/userId only
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { and, count, desc, eq, ne, or } from "drizzle-orm";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import type { D1Database } from "@cloudflare/workers-types";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { account, level, report, user } from "../db/schema";
import { first, getSessionUser, type SessionUser } from "./session";
import { getReplicaSession, readBookmark } from "./replica";

export function getRequestDb(event: H3Event): ReturnType<typeof getNodeDb> {
  const env = getAuthEnv(event);
  if (env.kind === "d1") {
    // Same sqlite query-builder surface as better-sqlite3 for basic CRUD.
    // Full auth tables included (account pages update the user row).
    return drizzleD1(env.d1!, { schema: { account, level, report, user } }) as unknown as ReturnType<
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

// Replica handle for read-only listings/player lookups on the edge:
// drizzle over a per-request D1 session (bookmark-chained when the
// browser carries one, else unconstrained), falling back to the primary
// handle off the edge. Writes and freshness-sensitive reads (own data,
// moderator review fallbacks) stay on getRequestDb — see
// server/utils/replica.ts for the contract.
export function getReplicaDb(event: H3Event): RequestDb {
  const session = getReplicaSession(event, readBookmark(event));
  if (!session) return getRequestDb(event);
  return drizzleD1(session as unknown as D1Database, {
    schema: { account, level, report, user },
  }) as unknown as RequestDb;
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

export function levelWhereForUser(id: string, session: SessionUser) {
  // Moderators may touch any level except the seeded stock row (the
  // default playable level — same exclusion as the public listings).
  if (session.isModerator) {
    return and(eq(level.id, id), ne(level.id, STOCK_LEVEL_ID));
  }
  return and(eq(level.id, id), eq(level.userId, session.id));
}

type RequestDb = ReturnType<typeof getNodeDb>;

// Seeded stock Green Hill row: the default playable level (also the
// archive DEFAULT_LEVEL_ID). Playable via / and the gateway, but never
// listed in All Levels and /play/2914 redirects home.
export const STOCK_LEVEL_ID = "2914";

// Rows per listing page (All Levels, Levels by X, My Levels).
export const LEVELS_PER_PAGE = 15;

// `?page=` query value: positive integer, 1 when missing/invalid.
// Callers clamp to the page count from below (count query first).
export function cleanPageParam(v: unknown): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}

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

// One page of the signed-in user's levels (the withPublished column set,
// metadata only): exactly 1 query over the userId index. Powers
// GET /editors/mylevels; GET /api/levels keeps using the unpaged helper.
export function listMyLevelsPage(
  db: RequestDb,
  userId: string,
  limit: number,
  offset: number,
) {
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
    .orderBy(desc(level.updatedAt))
    .limit(limit)
    .offset(offset);
}

// Total owned rows for the My Levels page count: exactly 1 indexed
// aggregate query reading no level rows.
export async function countMyLevels(
  db: RequestDb,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(level)
    .where(eq(level.userId, userId));
  return rows[0]?.n ?? 0;
}

// Published directory, metadata + author, stock excluded in SQL:
// exactly 1 query over the published index. `data` is never selected.
// Per-user directory ("Levels by X") rows. `authorId` is the stable link
// target: per-user URLs are keyed by user id (never the username, whose
// charset may grow spaces/punctuation/capitals later). The heading and
// bylines show the pretty-case `authorDisplay`. `data` is never selected.
export interface PublicLevelRow {
  id: string;
  authorId: string;
  name: string;
  author: string | null;
  authorDisplay: string | null;
  cols: number;
  rows: number;
  updatedAt: unknown;
}

export function listPublicLevels(
  db: RequestDb,
  limit: number,
  offset: number,
): Promise<PublicLevelRow[]> {
  return db
    .select({
      id: level.id,
      authorId: level.userId,
      name: level.name,
      author: user.username,
      authorDisplay: user.displayUsername,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID)))
    .orderBy(desc(level.updatedAt))
    .limit(limit)
    .offset(offset);
}

// Total published rows (stock excluded) for the All Levels page count:
// exactly 1 indexed aggregate query reading no level rows.
export async function countPublicLevels(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(level)
    .where(and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID)));
  return rows[0]?.n ?? 0;
}

// Per-user directory ("Levels by X"), published only: exactly 1 query
// over the userId index (published predicate + stock exclusion in SQL).
// The joined user columns double as the page heading source, so pages
// with levels cost no second lookup; empty results need findUserById to
// tell unknown ids (404) apart from unpublished creators.
export function listPublicLevelsByUserId(
  db: RequestDb,
  userId: string,
  limit: number,
  offset: number,
): Promise<PublicLevelRow[]> {
  return db
    .select({
      id: level.id,
      authorId: level.userId,
      name: level.name,
      author: user.username,
      authorDisplay: user.displayUsername,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(
      and(
        eq(level.userId, userId),
        eq(level.published, true),
        ne(level.id, STOCK_LEVEL_ID),
      ),
    )
    .orderBy(desc(level.updatedAt))
    .limit(limit)
    .offset(offset);
}

// Total published rows for one creator (stock excluded) for the Levels by
// X page count: exactly 1 indexed aggregate query reading no level rows.
export async function countPublicLevelsByUserId(
  db: RequestDb,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(level)
    .where(
      and(
        eq(level.userId, userId),
        eq(level.published, true),
        ne(level.id, STOCK_LEVEL_ID),
      ),
    );
  return rows[0]?.n ?? 0;
}

export interface PublicUser {
  id: string;
  username: string | null;
  displayUsername: string | null;
}

// User lookup for empty per-user pages: exactly 1 query reading exactly
// 1 row via the PK. Skipped entirely when the listing above returns rows.
export function findUserById(db: RequestDb, id: string) {
  return db
    .select({ id: user.id, username: user.username, displayUsername: user.displayUsername })
    .from(user)
    .where(eq(user.id, id));
}

// Player lookup: exactly 1 query reading exactly 1 row (name + published
// columns only) via PK + visibility predicate. Published rows serve
// everyone; owners additionally see their own unpublished rows.
// Moderators with an open report on the level fall through to
// findReportedLevelName below (a second query only on that rare miss path
// — the hot path stays at 1 query).
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

// Moderator fallback for the player: the same name + published columns for
// an unpublished level that still has >= 1 open report. Exactly 1 query:
// PK lookup on the level plus a probe into the open-report index that stops
// at the first match (LIMIT 1, `data` never read). Call only after
// findVisibleLevelName misses with a moderator session, so guests, members,
// and owners never pay for it. Callers run it on the primary (a just-filed
// report must be visible to the reviewing moderator).
export function findReportedLevelName(db: RequestDb, id: string) {
  return db
    .select({ name: level.name, published: level.published })
    .from(level)
    .innerJoin(
      report,
      and(eq(report.levelId, level.id), eq(report.status, "open")),
    )
    .where(eq(level.id, id))
    .limit(1);
}

// Open-report probe for the gateway: exactly 1 query reading <= 1 report
// row (id only) via the levelId + open-status indexes. Call only for an
// unpublished row a moderator doesn't own (on the primary, so a just-filed
// report is visible), so published/owned hits never pay for it.
export function hasOpenReport(db: RequestDb, levelId: string) {
  return db
    .select({ id: report.id })
    .from(report)
    .where(and(eq(report.levelId, levelId), eq(report.status, "open")))
    .limit(1);
}

export interface GatewayRow {
  data: string;
  name: string;
  published: boolean | null;
  userId: string;
}

// Gateway lookup: exactly 1 query reading exactly 1 row (PK), fetching
// only the columns the visibility check + byte encoder + played webhook
// need.
export function findGatewayRow(db: RequestDb, id: string) {
  return db
    .select({ data: level.data, name: level.name, published: level.published, userId: level.userId })
    .from(level)
    .where(eq(level.id, id));
}

// Report reason from a form/JSON value: trimmed text, 1–500 chars.
export function cleanReportReason(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  const reason = s.trim().replace(/\s+/g, " ");
  return reason.length >= 1 && reason.length <= 500 ? reason : null;
}

// File one report (reporter, level). Idempotent per open report: returns
// { duplicate: true } instead of writing when this user already has an
// open report on the level (the unique index is the race-safe backstop).
export async function createReport(
  db: RequestDb,
  levelId: string,
  reporterId: string,
  reason: string,
): Promise<{ duplicate: boolean }> {
  const existing = await db
    .select({ id: report.id })
    .from(report)
    .where(
      and(
        eq(report.levelId, levelId),
        eq(report.reporterId, reporterId),
        eq(report.status, "open"),
      ),
    )
    .limit(1);
  if (existing.length > 0) return { duplicate: true };
  try {
    await db.insert(report).values({
      id: crypto.randomUUID(),
      levelId,
      reporterId,
      reason,
      createdAt: new Date(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique|constraint/i.test(msg)) return { duplicate: true };
    throw e;
  }
  return { duplicate: false };
}

export interface OpenReportRow {
  reportId: string;
  reason: string;
  createdAt: unknown;
  reporterDisplay: string | null;
  levelId: string;
  levelName: string;
  levelCols: number;
  levelRows: number;
  authorId: string;
  authorDisplay: string | null;
}

// Total open reports for the queue page count: exactly 1 indexed
// aggregate query reading no report rows.
export async function countOpenReports(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(report)
    .where(eq(report.status, "open"));
  return rows[0]?.n ?? 0;
}

// One page of open reports with level + reporter + author, newest first:
// exactly 1 query (status walk over the composite index, level/reporter/
// author joins over PKs, `data` never read). Callers group by levelId for
// the moderator queue.
export function listOpenReports(
  db: RequestDb,
  limit: number,
  offset: number,
): Promise<OpenReportRow[]> {
  const reporter = alias(user, "reporter");
  const author = alias(user, "author");
  return db
    .select({
      reportId: report.id,
      reason: report.reason,
      createdAt: report.createdAt,
      reporterDisplay: reporter.displayUsername,
      levelId: level.id,
      levelName: level.name,
      levelCols: level.cols,
      levelRows: level.rows,
      authorId: level.userId,
      authorDisplay: author.displayUsername,
    })
    .from(report)
    .innerJoin(level, eq(report.levelId, level.id))
    .innerJoin(reporter, eq(report.reporterId, reporter.id))
    .innerJoin(author, eq(level.userId, author.id))
    .where(eq(report.status, "open"))
    .orderBy(desc(report.createdAt))
    .limit(limit)
    .offset(offset);
}

// Dismiss every open report on one level: exactly 1 indexed write.
// Returns the number of dismissed rows.
export async function dismissReportsForLevel(
  db: RequestDb,
  levelId: string,
): Promise<number> {
  const dismissed = await db
    .update(report)
    .set({ status: "dismissed" })
    .where(and(eq(report.levelId, levelId), eq(report.status, "open")))
    .returning({ id: report.id });
  return dismissed.length;
}