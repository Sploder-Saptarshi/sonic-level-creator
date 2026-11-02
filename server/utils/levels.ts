// Level storage helpers shared by the API and page routes. D1 bills
// rows_read: helpers select only the columns they need, never `data` in
// listings, and every query walks an index.
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import { getRouterParam } from "nitro/h3";
import type { D1Database } from "@cloudflare/workers-types";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { account, level, report, stats, user } from "../db/schema";
import { enforceSameOrigin } from "./authFlow";
import { dbLogger } from "./timing";
import { first, getSessionUser, type SessionUser } from "./session";
import { getReplicaSession, pinFreshBookmark, readBookmark } from "./replica";
import { notifyLevelDeleted } from "./webhook";

type RequestDb = ReturnType<typeof getNodeDb>;

export function getRequestDb(event: H3Event): RequestDb {
  const env = getAuthEnv(event);
  if (env.kind === "d1") {
    return drizzleD1(env.d1!, {
      schema: { account, level, report, user },
      logger: dbLogger(event),
    }) as unknown as RequestDb;
  }
  return getNodeDb(event);
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event);
  if (!user) throw new HTTPError({ status: 401, message: "Sign in required" });
  return user;
}

// Read-only handle for replica-safe reads; primary off the edge. Writes and
// freshness-sensitive reads use getRequestDb (see server/utils/replica.ts).
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
  // 1MB cap keeps a level well under D1 row limits.
  return typeof s === "string" && s.length <= 1_000_000 ? s : null;
}

export interface LevelBody {
  name: string;
  cols: number;
  rows: number;
  data: string;
}

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

export function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return row;
}

export function cleanId(v: unknown): string | null {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 128 ? s : null;
}

// Ids are numeric strings or UUIDs; anything else is a probe. Rejects
// before any SQL.
export function isSafeId(v: unknown): v is string {
  return typeof v === "string" && /^[\w-]{1,128}$/.test(v);
}

// CSRF guard + session + validated `:id`. GET passes `{ sameOrigin: false }`.
export async function requireUserAndLevelId(
  event: H3Event,
  opts: { sameOrigin?: boolean } = {},
): Promise<{ user: SessionUser; id: string }> {
  if (opts.sameOrigin !== false) enforceSameOrigin(event);
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  return { user, id };
}

// RETURNING doubles as the existence check.
export function renameLevelWhere(db: RequestDb, where: any, name: string) {
  return db
    .update(level)
    .set({ name, updatedAt: new Date() })
    .where(where)
    .returning({ id: level.id });
}

// D1 can't rely on PRAGMA foreign_keys, so reports are removed explicitly,
// and only after the predicate-checked delete succeeds (a forged id can't
// wipe another level's reports). Returns the deleted rows (empty on miss).
export async function deleteLevelWithReports(db: RequestDb, where: any) {
  const deleted = await db
    .delete(level)
    .where(where)
    .returning({ id: level.id, name: level.name, published: level.published });
  const row = deleted[0];
  if (row) await db.delete(report).where(eq(report.levelId, row.id));
  return deleted;
}

// Form handlers: owner-or-moderator writes, then pin a bookmark so the
// redirect observes them.
export async function renameLevelAs(event: H3Event, session: SessionUser, id: string, name: string) {
  await renameLevelWhere(getRequestDb(event), levelWhereForUser(id, session), name);
  await pinFreshBookmark(event);
}

export async function deleteLevelAs(event: H3Event, session: SessionUser, id: string) {
  const [row] = await deleteLevelWithReports(getRequestDb(event), levelWhereForUser(id, session));
  if (!row) return;
  await pinFreshBookmark(event);
  notifyLevelDeleted(event, { ...row, actor: session.username });
}

export function levelWhere(id: string, userId: string) {
  return and(eq(level.id, id), eq(level.userId, userId));
}

export function levelWhereForUser(id: string, session: SessionUser) {
  // Moderators may touch any level except the stock row.
  if (session.isModerator) {
    return and(eq(level.id, id), ne(level.id, STOCK_LEVEL_ID));
  }
  return and(eq(level.id, id), eq(level.userId, session.id));
}

// Seeded Green Hill level (DEFAULT_LEVEL_ID). Playable via / and the
// gateway; never listed, and /play/2914 redirects home.
export const STOCK_LEVEL_ID = "2914";

export const LEVELS_PER_PAGE = 15;

export function cleanPageParam(v: unknown): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}

export function listMyLevels(db: RequestDb, userId: string) {
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

// Keyset pagination: listings sort by (ts DESC, id DESC) and a cursor pins
// the edge row of the current page, so every page costs O(page size). The
// displayed page number rides along in links but never drives fetching.
export interface PageCursor {
  // Stored unit: unix seconds.
  ts: number;
  id: string;
}

export interface KeysetPage {
  after?: PageCursor | null;
  before?: PageCursor | null;
}

export interface PageResult<T> {
  rows: T[];
  hasMore: boolean;
  hasPrev: boolean;
}

// base64url of [ts, id], UTF-8 safe.
export function encodePageCursor(ts: number, id: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([ts, id]));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Malformed cursors return null, which degrades to the first page.
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

// Folds Dates (and raw ms) to the stored unix-seconds integer so the cursor
// binds exactly what the index holds.
function storedTs(v: unknown): number {
  const ms = v instanceof Date ? v.getTime() : Number(v);
  if (!Number.isFinite(ms)) return 0;
  const t = Math.trunc(ms);
  return t > 1e12 ? Math.floor(t / 1000) : t;
}

export function cursorFor(tsValue: unknown, id: string): string {
  return encodePageCursor(storedTs(tsValue), id);
}

// `after` wins when both cursors are sent.
export function parseKeysetQuery(q: Record<string, unknown>): {
  after: PageCursor | null;
  incoming: PageCursor | null;
  keyset: KeysetPage;
} {
  const after = cleanCursorParam(q.after);
  const incoming = after ?? cleanCursorParam(q.before);
  return {
    after,
    incoming,
    keyset: after ? { after } : incoming ? { before: incoming } : {},
  };
}

// Display-only: a tampered `page` can mislabel the indicator but never
// changes which rows are fetched.
export function clampListingPage(
  pageParam: unknown,
  total: number,
): { page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  const page = Math.min(Math.max(cleanPageParam(pageParam), 1), totalPages);
  return { page, totalPages };
}

// An empty page (rows deleted since) links back via the incoming cursor.
export function keysetCursors<T>(
  rows: T[],
  opts: {
    hasMore: boolean;
    hasPrev: boolean;
    incoming: PageCursor | null;
    tsOf: (row: T) => unknown;
    idOf: (row: T) => string;
  },
): { prevCursor: string | null; nextCursor: string | null } {
  const { hasMore, hasPrev, incoming, tsOf, idOf } = opts;
  const head = rows[0];
  const last = rows[rows.length - 1];
  let prevCursor: string | null = null;
  if (head && hasPrev) prevCursor = cursorFor(tsOf(head), idOf(head));
  else if (!head && incoming) prevCursor = encodePageCursor(incoming.ts, incoming.id);
  const nextCursor = last && hasMore ? cursorFor(tsOf(last), idOf(last)) : null;
  return { prevCursor, nextCursor };
}

// Fetches limit+1 rows; the extra row signals another page without a COUNT.
// `query` builds the caller's select; this supplies the seek and order.
async function fetchKeysetPage<T>(opts: {
  limit: number;
  page: KeysetPage;
  tsCol: any;
  idCol: any;
  whereBase: any;
  query: (where: any, orderBy: [any, any]) => Promise<T[]>;
}): Promise<PageResult<T>> {
  if (opts.page.before) {
    const c = opts.page.before;
    const rows = await opts.query(
      and(
        opts.whereBase,
        sql`(${opts.tsCol} > ${c.ts} OR (${opts.tsCol} = ${c.ts} AND ${opts.idCol} > ${c.id}))`,
      ),
      [asc(opts.tsCol), asc(opts.idCol)],
    );
    const hasPrev = rows.length > opts.limit;
    const kept = (hasPrev ? rows.slice(0, opts.limit) : rows).reverse();
    return { rows: kept, hasMore: true, hasPrev };
  }
  const c = opts.page.after;
  const rows = await opts.query(
    c
      ? and(
          opts.whereBase,
          sql`(${opts.tsCol} < ${c.ts} OR (${opts.tsCol} = ${c.ts} AND ${opts.idCol} < ${c.id}))`,
        )
      : opts.whereBase,
    [desc(opts.tsCol), desc(opts.idCol)],
  );
  const hasMore = rows.length > opts.limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!c };
}

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
  return fetchKeysetPage({
    limit,
    page,
    tsCol: level.updatedAt,
    idCol: level.id,
    whereBase: base,
    query: (where, orderBy) =>
      db.select(cols).from(level).where(where).orderBy(...orderBy).limit(limit + 1),
  });
}

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

// Per-user URLs are keyed by `authorId` (usernames may contain spaces and
// punctuation); bylines show `authorDisplay`.
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

const PUBLIC_LEVEL_COLS = {
  id: level.id,
  authorId: level.userId,
  name: level.name,
  author: user.username,
  authorDisplay: user.displayUsername,
  cols: level.cols,
  rows: level.rows,
  updatedAt: level.updatedAt,
};

export async function listPublicLevels(
  db: RequestDb,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<PublicLevelRow>> {
  const base = and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID));
  return fetchKeysetPage({
    limit,
    page,
    tsCol: level.updatedAt,
    idCol: level.id,
    whereBase: base,
    query: (where, orderBy) =>
      db.select(PUBLIC_LEVEL_COLS).from(level).innerJoin(user, eq(level.userId, user.id)).where(where).orderBy(...orderBy).limit(limit + 1),
  });
}

export async function getPublishedLevelTotal(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: stats.publishedLevels })
    .from(stats)
    .where(eq(stats.id, 1));
  return rows[0]?.n ?? 0;
}

export async function listPublicLevelsByUserId(
  db: RequestDb,
  userId: string,
  limit: number,
  page: KeysetPage,
): Promise<PageResult<PublicLevelRow>> {
  const base = and(
    eq(level.userId, userId),
    eq(level.published, true),
    ne(level.id, STOCK_LEVEL_ID),
  );
  return fetchKeysetPage({
    limit,
    page,
    tsCol: level.updatedAt,
    idCol: level.id,
    whereBase: base,
    query: (where, orderBy) =>
      db.select(PUBLIC_LEVEL_COLS).from(level).innerJoin(user, eq(level.userId, user.id)).where(where).orderBy(...orderBy).limit(limit + 1),
  });
}

export interface PublicUser {
  id: string;
  username: string | null;
  displayUsername: string | null;
}

// One PK read covers existence, heading name and the page total.
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

// Published levels are visible to everyone, unpublished ones to their owner.
// Moderators fall back to findReportedLevelName on a miss.
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

// Moderator fallback: an unpublished level with an open report. Run on the
// primary so a just-filed report is visible.
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

// Gateway moderator fallback. Run on the primary so a just-filed report is
// visible.
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

export function findGatewayRow(db: RequestDb, id: string) {
  return db
    .select({ data: level.data, name: level.name, published: level.published, userId: level.userId })
    .from(level)
    .where(eq(level.id, id));
}

export function cleanReportReason(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  const reason = s.trim().replace(/\s+/g, " ");
  return reason.length >= 1 && reason.length <= 500 ? reason : null;
}

// Idempotent per open report; the unique index is the race-safe backstop.
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

export async function getOpenReportTotal(db: RequestDb): Promise<number> {
  const rows = await db
    .select({ n: stats.openReports })
    .from(stats)
    .where(eq(stats.id, 1));
  return rows[0]?.n ?? 0;
}

// Newest first; callers group rows by level for the moderator queue.
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
  return fetchKeysetPage({
    limit,
    page,
    tsCol: report.createdAt,
    idCol: report.id,
    whereBase: base,
    query: (where, orderBy) =>
      join(db.select(cols).from(report).where(where).orderBy(...orderBy).limit(limit + 1)),
  });
}

// Returns the number of dismissed reports.
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