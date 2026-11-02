// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { and, desc, eq, ne, or, type SQL } from "drizzle-orm";
import type { H3Event } from "nitro";
import { level, report, stats, user } from "../db/schema";
import { getRequestDb, type Db } from "./db";
import { fetchKeysetPage, type KeysetPage } from "./pagination";
import { pinFreshBookmark } from "./replica";
import type { SessionUser } from "./session";
import { notifyLevelDeleted } from "./webhook";

// The seeded Green Hill level: playable from /, but never listed.
export const STOCK_LEVEL_ID = "2914";

export function levelWhere(id: string, userId: string) {
  return and(eq(level.id, id), eq(level.userId, userId));
}

function levelWhereForUser(id: string, session: SessionUser) {
  if (session.isModerator) return and(eq(level.id, id), ne(level.id, STOCK_LEVEL_ID));
  return levelWhere(id, session.id);
}

// D1 doesn't enforce foreign keys, so reports are deleted by hand, and only
// once the level delete actually matched.
export async function deleteLevelWithReports(db: Db, where: SQL | undefined) {
  const deleted = await db
    .delete(level)
    .where(where)
    .returning({ id: level.id, name: level.name, published: level.published });
  const row = deleted[0];
  if (row) await db.delete(report).where(eq(report.levelId, row.id));
  return deleted;
}

export async function renameLevelAs(event: H3Event, session: SessionUser, id: string, name: string) {
  await getRequestDb(event)
    .update(level)
    .set({ name, updatedAt: new Date() })
    .where(levelWhereForUser(id, session));
  await pinFreshBookmark(event);
}

export async function deleteLevelAs(event: H3Event, session: SessionUser, id: string) {
  const [row] = await deleteLevelWithReports(getRequestDb(event), levelWhereForUser(id, session));
  if (!row) return;
  await pinFreshBookmark(event);
  notifyLevelDeleted(event, { ...row, actor: session.username });
}

export function listMyLevels(db: Db, userId: string) {
  return db
    .select({ id: level.id, name: level.name, cols: level.cols, rows: level.rows, updatedAt: level.updatedAt })
    .from(level)
    .where(eq(level.userId, userId))
    .orderBy(desc(level.updatedAt));
}

const MY_LEVEL_COLS = {
  id: level.id,
  name: level.name,
  cols: level.cols,
  rows: level.rows,
  published: level.published,
  updatedAt: level.updatedAt,
};

export function listMyLevelsPage(db: Db, userId: string, limit: number, page: KeysetPage) {
  return fetchKeysetPage({
    limit,
    page,
    tsCol: level.updatedAt,
    idCol: level.id,
    where: eq(level.userId, userId),
    query: (where, orderBy) =>
      db.select(MY_LEVEL_COLS).from(level).where(where).orderBy(...orderBy).limit(limit + 1),
  });
}

export async function getMyLevelTotal(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ n: user.levelCount }).from(user).where(eq(user.id, userId));
  return row?.n ?? 0;
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

export type PublicLevelRow = Awaited<ReturnType<typeof listPublicLevels>>["rows"][number];

function listPublished(db: Db, where: SQL | undefined, limit: number, page: KeysetPage) {
  return fetchKeysetPage({
    limit,
    page,
    tsCol: level.updatedAt,
    idCol: level.id,
    where: and(eq(level.published, true), ne(level.id, STOCK_LEVEL_ID), where),
    query: (w, orderBy) =>
      db.select(PUBLIC_LEVEL_COLS).from(level).innerJoin(user, eq(level.userId, user.id)).where(w).orderBy(...orderBy).limit(limit + 1),
  });
}

export function listPublicLevels(db: Db, limit: number, page: KeysetPage) {
  return listPublished(db, undefined, limit, page);
}

export function listPublicLevelsByUserId(db: Db, userId: string, limit: number, page: KeysetPage) {
  return listPublished(db, eq(level.userId, userId), limit, page);
}

export async function getPublishedLevelTotal(db: Db): Promise<number> {
  const [row] = await db.select({ n: stats.publishedLevels }).from(stats).where(eq(stats.id, 1));
  return row?.n ?? 0;
}

export function findUserById(db: Db, id: string) {
  return db
    .select({
      id: user.id,
      username: user.username,
      displayUsername: user.displayUsername,
      publishedLevelCount: user.publishedLevelCount,
    })
    .from(user)
    .where(eq(user.id, id));
}

export function findVisibleLevelName(db: Db, id: string, session: SessionUser | null) {
  const visible = session
    ? or(eq(level.published, true), eq(level.userId, session.id))
    : eq(level.published, true);
  return db
    .select({ name: level.name, published: level.published })
    .from(level)
    .where(and(eq(level.id, id), visible));
}

export type GatewayRow = Awaited<ReturnType<typeof findGatewayRow>>[number];

export function findGatewayRow(db: Db, id: string) {
  return db
    .select({ data: level.data, name: level.name, published: level.published, userId: level.userId })
    .from(level)
    .where(eq(level.id, id));
}
