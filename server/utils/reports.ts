import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { level, report, stats, user } from "../db/schema";
import type { Db } from "./db";
import { fetchKeysetPage, type KeysetPage } from "./pagination";

const openReportOn = (levelId: string) => and(eq(report.levelId, levelId), eq(report.status, "open"));

// run on the primary so a just-filed report is visible
export function findReportedLevelName(db: Db, id: string) {
  return db
    .select({ name: level.name, published: level.published })
    .from(level)
    .innerJoin(report, and(eq(report.levelId, level.id), eq(report.status, "open")))
    .where(eq(level.id, id))
    .limit(1);
}

// run on the primary so a just-filed report is visible
export function hasOpenReport(db: Db, levelId: string) {
  return db.select({ id: report.id }).from(report).where(openReportOn(levelId)).limit(1);
}

export async function createReport(db: Db, levelId: string, reporterId: string, reason: string): Promise<{ duplicate: boolean }> {
  const existing = await db
    .select({ id: report.id })
    .from(report)
    .where(and(openReportOn(levelId), eq(report.reporterId, reporterId)))
    .limit(1);
  if (existing.length > 0) return { duplicate: true };
  try {
    await db.insert(report).values({ id: crypto.randomUUID(), levelId, reporterId, reason, createdAt: new Date() });
  } catch (e) {
    // lost a race with an identical report
    if (e instanceof Error && /unique|constraint/i.test(e.message)) return { duplicate: true };
    throw e;
  }
  return { duplicate: false };
}

export async function getOpenReportTotal(db: Db): Promise<number> {
  const [row] = await db.select({ n: stats.openReports }).from(stats).where(eq(stats.id, 1));
  return row?.n ?? 0;
}

export type OpenReportRow = Awaited<ReturnType<typeof listOpenReports>>["rows"][number];

export function listOpenReports(db: Db, limit: number, page: KeysetPage) {
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
  return fetchKeysetPage({
    limit,
    page,
    tsCol: report.createdAt,
    idCol: report.id,
    where: eq(report.status, "open"),
    query: (where, orderBy) =>
      db.select(cols)
        .from(report)
        .innerJoin(level, eq(report.levelId, level.id))
        .innerJoin(reporter, eq(report.reporterId, reporter.id))
        .innerJoin(author, eq(level.userId, author.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(limit + 1),
  });
}

export async function dismissReportsForLevel(db: Db, levelId: string): Promise<void> {
  await db.update(report).set({ status: "dismissed" }).where(openReportOn(levelId));
}
