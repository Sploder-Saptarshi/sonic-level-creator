// server/utils/levels.ts — session-scoped level storage helpers (API + pages).
// One drizzle handle per request: D1 on the edge, local SQLite on node.
//
// Query/row budgets (D1 bills rows_read — every helper below is minimal):
//   requireUser            0-1 reads (0 without cookie, 1 session row with)
//   readLevelBody          0 SQL (pure validation, fails before any write)
//   requireRow             0 SQL (folds a 404 check onto an existing result)
//   listMyLevels           1 query, metadata-only columns (never `data`),
//                          N rows for N owned levels over the userId index
//   listMyLevelsPage       1 query, one keyset page of owned metadata over
//                          the (userId, updatedAt) index (LIMIT n+1 probe,
//                          no OFFSET — deep pages cost what shallow ones do)
//   getMyLevelTotal        1 query, 1 row (trigger-kept user.level_count)
//   listPublicLevels       1 query, one keyset page of published metadata +
//                          author over the (published, updatedAt) index
//   getPublishedLevelTotal 1 query, 1 row (trigger-kept stats row)
//   listPublicLevelsByUserId 1 query, one keyset page of published metadata
//                          + author over the (userId, published, updatedAt)
//                          index
//   findUserById           1 query, 1 row (id + username + both per-user
//                          counters; existence check and page total in one —
//                          replaces countPublicLevelsByUserId entirely)
//   listOpenReports        1 query, one keyset page over the (status,
//                          createdAt) index (LIMIT n+1 probe, no OFFSET)
//   getOpenReportTotal     1 query, 1 row (trigger-kept stats row)
//   findVisibleLevelName   1 query, 1 row, name + published only (PK + visibility)
//   findReportedLevelName  1 query, <= 1 row, name + published only (PK +
//                          one open-report join; moderator fallback only)
//   hasOpenReport          1 query, <= 1 row, report id only (levelId +
//                          status probe; gateway moderator fallback only)
//   findGatewayRow         1 query, 1 row, data/name/published/userId only
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import type { D1Database } from "@cloudflare/workers-types";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { account, level, report, stats, user } from "../db/schema";
import { dbLogger } from "./timing";
import { first, getSessionUser, type SessionUser } from "./session";
import { getReplicaSession, readBookmark } from "./replica";

export function getRequestDb(event: H3Event): ReturnType<typeof getNodeDb> {
  const env = getAuthEnv(event);
  if (env.kind === "d1") {
    // Same sqlite query-builder surface as better-sqlite3 for basic CRUD.
    // Full auth tables included (account pages update the user row).
    // Per-request logger feeds the timing badge's query count.
    return drizzleD1(env.d1!, { schema: { account, level, report, user }, logger: dbLogger(event) }) as unknown as ReturnType<
      typeof getNodeDb
    >;
  }
  return getNodeDb(event);
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
    logger: dbLogger(event),
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

// Keyset (cursor) pagination: every listing sorts (ts DESC, id DESC) with
// the id tiebreak making the order total even when timestamps collide
// (publish/rename stamp updatedAt at ms resolution — ties are routine).
// A cursor pins the last row of the current page; the next page seeks
// strictly past it inside the index instead of scanning + discarding
// OFFSET rows. Cost per page is O(page size) at any depth. Trade-off vs
// OFFSET: no random jumps — navigation is prev/next from a known row, and
// rows inserted ahead shift later pages (same staleness the replica reads
// already accept). The displayed `Page N/T` number rides along in the
// prev/next links for continuity but is never used for fetching.
export interface PageCursor {
  // updatedAt/createdAt in the raw stored unit (unix seconds — drizzle's
  // sqlite timestamp mode) + the row id tiebreak.
  ts: number;
  id: string;
}

export interface KeysetPage {
  // Forward from here (next page) / backward from here (prev page). Routes
  // never send both; `after` wins when they do.
  after?: PageCursor | null;
  before?: PageCursor | null;
}

export interface PageResult<T> {
  rows: T[];
  hasMore: boolean;
  hasPrev: boolean;
}

// Opaque cursor token for URLs: base64url of [ts, id]. TextEncoder-based
// (never btoa on raw input) so any id charset survives; works unchanged
// on Workers and node.
export function encodePageCursor(ts: number, id: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([ts, id]));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Validated `after=`/`before=` query value: null when missing/malformed
// (callers fall back to the first page — a tampered cursor degrades to
// page one, never to an error or a scan).
export function cleanCursorParam(v: unknown): PageCursor | null {
  const s = first(v);
  if (typeof s !== "string" || s.length < 1 || s.length > 512) return null;
  if (!/^[A-Za-z0-9\-_]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const [ts, id] = JSON.parse(new TextDecoder().decode(bytes));
    if (!Number.isInteger(ts) || ts < 0 || ts > 1e15) return null;
    if (typeof id !== "string" || id.length < 1 || id.length > 128) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

// updatedAt/createdAt arrive as Date (drizzle timestamp mode) — fold to
// the stored unit (unix seconds) so the cursor binds the exact integer
// the index holds. Raw numbers are accepted too: values past 1e12 can
// only be ms (seconds reach that in the year 33658) and fold down.
function storedTs(v: unknown): number {
  const ms = v instanceof Date ? v.getTime() : Number(v);
  if (!Number.isFinite(ms)) return 0;
  const t = Math.trunc(ms);
  return t > 1e12 ? Math.floor(t / 1000) : t;
}

// Cursor token for the edge row of a fetched page (first row for `before`
// links, last row for `after` links).
export function cursorFor(tsValue: unknown, id: string): string {
  return encodePageCursor(storedTs(tsValue), id);
}

// One page of the signed-in user's levels (the withPublished column set,
// metadata only): exactly 1 query over the (userId, updatedAt) index.
// Fetches limit+1 rows; the extra row is the next/prev existence probe
// (popped before return), so no COUNT query is ever needed for chevrons.
export async function listMyLevelsPage(
  db: RequestDb,
  userId: string,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<{ id: string; name: string; cols: number; rows: number; published: boolean | null; updatedAt: Date }>> {
  const cols = {
    id: level.id,
    name: level.name,
    cols: level.cols,
    rows: level.rows,
    published: level.published,
    updatedAt: level.updatedAt,
  };
  const base = eq(level.userId, userId);
  if (page.before) {
    const c = page.before;
    const rows = await db
      .select(cols)
      .from(level)
      .where(
        and(
          base,
          sql`(${level.updatedAt} > ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} > ${c.id}))`,
        ),
      )
      .orderBy(asc(level.updatedAt), asc(level.id))
      .limit(limit + 1);
    // The +1 row is the farthest one; drop it, then restore DESC order.
    const hasPrev = rows.length > limit;
    const kept = (hasPrev ? rows.slice(0, limit) : rows).reverse();
    return { rows: kept, hasMore: true, hasPrev };
  }
  const c = page.after;
  const rows = await db
    .select(cols)
    .from(level)
    .where(
      c
        ? and(
            base,
            sql`(${level.updatedAt} < ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} < ${c.id}))`,
          )
        : base,
    )
    .orderBy(desc(level.updatedAt), desc(level.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!c };
}

// Total owned rows for the My Levels page count: 1 query reading exactly
// 1 row (trigger-kept user.level_count — mirrors the unpaged countMyLevels
// predicate: any state, stock row included).
export async function getMyLevelTotal(
  db: RequestDb,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ n: user.levelCount })
    .from(user)
    .where(eq(user.id, userId));
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

export async function listPublicLevels(
  db: RequestDb,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<PublicLevelRow>> {
  const cols = {
    id: level.id,
    authorId: level.userId,
    name: level.name,
    author: user.username,
    authorDisplay: user.displayUsername,
    cols: level.cols,
    rows: level.rows,
    updatedAt: level.updatedAt,
  };
  const base = and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID));
  if (page.before) {
    const c = page.before;
    const rows = await db
      .select(cols)
      .from(level)
      .innerJoin(user, eq(level.userId, user.id))
      .where(
        and(
          base,
          sql`(${level.updatedAt} > ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} > ${c.id}))`,
        ),
      )
      .orderBy(asc(level.updatedAt), asc(level.id))
      .limit(limit + 1);
    const hasPrev = rows.length > limit;
    const kept = (hasPrev ? rows.slice(0, limit) : rows).reverse();
    return { rows: kept, hasMore: true, hasPrev };
  }
  const c = page.after;
  const rows = await db
    .select(cols)
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(
      c
        ? and(
            base,
            sql`(${level.updatedAt} < ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} < ${c.id}))`,
          )
        : base,
    )
    .orderBy(desc(level.updatedAt), desc(level.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!c };
}

// Total published rows (stock excluded) for the All Levels page count:
// 1 query reading exactly 1 row (trigger-kept stats row).
export async function getPublishedLevelTotal(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: stats.publishedLevels })
    .from(stats)
    .where(eq(stats.id, 1));
  return rows[0]?.n ?? 0;
}

// Per-user directory ("Levels by X"), published only: exactly 1 query
// over the userId index (published predicate + stock exclusion in SQL).
// The joined user columns double as the page heading source, so pages
// with levels cost no second lookup; empty results need findUserById to
// tell unknown ids (404) apart from unpublished creators.
export async function listPublicLevelsByUserId(
  db: RequestDb,
  userId: string,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<PublicLevelRow>> {
  const cols = {
    id: level.id,
    authorId: level.userId,
    name: level.name,
    author: user.username,
    authorDisplay: user.displayUsername,
    cols: level.cols,
    rows: level.rows,
    updatedAt: level.updatedAt,
  };
  const base = and(
    eq(level.userId, userId),
    eq(level.published, true),
    ne(level.id, STOCK_LEVEL_ID),
  );
  if (page.before) {
    const c = page.before;
    const rows = await db
      .select(cols)
      .from(level)
      .innerJoin(user, eq(level.userId, user.id))
      .where(
        and(
          base,
          sql`(${level.updatedAt} > ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} > ${c.id}))`,
        ),
      )
      .orderBy(asc(level.updatedAt), asc(level.id))
      .limit(limit + 1);
    const hasPrev = rows.length > limit;
    const kept = (hasPrev ? rows.slice(0, limit) : rows).reverse();
    return { rows: kept, hasMore: true, hasPrev };
  }
  const c = page.after;
  const rows = await db
    .select(cols)
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(
      c
        ? and(
            base,
            sql`(${level.updatedAt} < ${c.ts} OR (${level.updatedAt} = ${c.ts} AND ${level.id} < ${c.id}))`,
          )
        : base,
    )
    .orderBy(desc(level.updatedAt), desc(level.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!c };
}

export interface PublicUser {
  id: string;
  username: string | null;
  displayUsername: string | null;
}

// User lookup for the per-user pages: exactly 1 query reading exactly
// 1 row via the PK — existence (404 unknown ids), heading name, AND the
// published page total (trigger-kept user.published_level_count) in one.
// Skipped entirely when not needed; empty results render from this row.
export function findUserById(db: RequestDb, id: string) {
  return db
    .select({
      id: user.id,
      username: user.username,
      displayUsername: user.displayUsername,
      levelCount: user.levelCount,
      publishedLevelCount: user.publishedLevelCount,
    })
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

// Total open reports for the queue page count: 1 query reading exactly
// 1 row (trigger-kept stats row).
export async function getOpenReportTotal(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: stats.openReports })
    .from(stats)
    .where(eq(stats.id, 1));
  return rows[0]?.n ?? 0;
}

// One page of open reports with level + reporter + author, newest first:
// exactly 1 query (status walk over the composite index, level/reporter/
// author joins over PKs, `data` never read). Keyset on (createdAt, id);
// fetches limit+1 rows as the next/prev existence probe. Callers group by
// levelId for the moderator queue.
export async function listOpenReports(
  db: RequestDb,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<OpenReportRow>> {
  const reporter = alias(user, "reporter");
  const author = alias(user, "author");
  const cols = {
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
  };
  const base = eq(report.status, "open");
  const join = (q: any) =>
    q
      .innerJoin(level, eq(report.levelId, level.id))
      .innerJoin(reporter, eq(report.reporterId, reporter.id))
      .innerJoin(author, eq(level.userId, author.id));
  if (page.before) {
    const c = page.before;
    const rows = await join(
      db
        .select(cols)
        .from(report)
        .where(
          and(
            base,
            sql`(${report.createdAt} > ${c.ts} OR (${report.createdAt} = ${c.ts} AND ${report.id} > ${c.id}))`,
          ),
        )
        .orderBy(asc(report.createdAt), asc(report.id))
        .limit(limit + 1),
    );
    const hasPrev = rows.length > limit;
    const kept = (hasPrev ? rows.slice(0, limit) : rows).reverse();
    return { rows: kept, hasMore: true, hasPrev };
  }
  const c = page.after;
  const rows = await join(
    db
      .select(cols)
      .from(report)
      .where(
        c
          ? and(
              base,
              sql`(${report.createdAt} < ${c.ts} OR (${report.createdAt} = ${c.ts} AND ${report.id} < ${c.id}))`,
            )
          : base,
      )
      .orderBy(desc(report.createdAt), desc(report.id))
      .limit(limit + 1),
  );
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!c };
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