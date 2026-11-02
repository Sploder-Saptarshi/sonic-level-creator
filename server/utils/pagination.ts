// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Keyset pagination: rows sort by (timestamp DESC, id DESC) and links carry
// a cursor for the edge row, so deep pages cost the same as the first.

import { and, asc, desc, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { H3Event } from "nitro";
import { getQuery } from "nitro/h3";
import { first } from "./session";

export const LEVELS_PER_PAGE = 15;

interface PageCursor {
  ts: number; // unix seconds
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

export interface ListingQuery {
  keyset: KeysetPage;
  incoming: PageCursor | null;
  page: unknown;
}

function encodeCursor({ ts, id }: PageCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify([ts, id]));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(v: unknown): PageCursor | null {
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

export function readListingQuery(event: H3Event): ListingQuery {
  const q = getQuery(event);
  const after = decodeCursor(q.after);
  const incoming = after ?? decodeCursor(q.before);
  return {
    keyset: after ? { after } : incoming ? { before: incoming } : {},
    incoming,
    page: q.page,
  };
}

// The page number is display-only; rows are always fetched by cursor.
export function pageNumbers(pageParam: unknown, total: number): { page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  const n = Number(first(pageParam));
  const requested = Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
  return { page: Math.min(requested, totalPages), totalPages };
}

export interface RowCursor {
  ts: unknown;
  id: string;
}

function cursorOfRow({ ts, id }: RowCursor): string {
  return encodeCursor({ ts: ts instanceof Date ? Math.floor(ts.getTime() / 1000) : 0, id });
}

// An empty page (rows deleted since) links back via the incoming cursor.
export function pageCursors<T>(
  result: PageResult<T>,
  incoming: PageCursor | null,
  cursorOf: (row: T) => RowCursor,
): { prev: string | null; next: string | null } {
  const head = result.rows[0];
  const last = result.rows[result.rows.length - 1];
  let prev: string | null = null;
  if (head && result.hasPrev) prev = cursorOfRow(cursorOf(head));
  else if (!head && incoming) prev = encodeCursor(incoming);
  const next = last && result.hasMore ? cursorOfRow(cursorOf(last)) : null;
  return { prev, next };
}

// Fetches limit+1 rows; the extra row tells us there's another page.
export async function fetchKeysetPage<T>(opts: {
  limit: number;
  page: KeysetPage;
  tsCol: AnySQLiteColumn;
  idCol: AnySQLiteColumn;
  where: SQL | undefined;
  query: (where: SQL | undefined, orderBy: [SQL, SQL]) => Promise<T[]>;
}): Promise<PageResult<T>> {
  const { limit, tsCol, idCol } = opts;
  const before = opts.page.before;
  if (before) {
    const rows = await opts.query(
      and(opts.where, sql`(${tsCol} > ${before.ts} OR (${tsCol} = ${before.ts} AND ${idCol} > ${before.id}))`),
      [asc(tsCol), asc(idCol)],
    );
    const hasPrev = rows.length > limit;
    return { rows: (hasPrev ? rows.slice(0, limit) : rows).reverse(), hasMore: true, hasPrev };
  }
  const after = opts.page.after;
  const rows = await opts.query(
    after
      ? and(opts.where, sql`(${tsCol} < ${after.ts} OR (${tsCol} = ${after.ts} AND ${idCol} < ${after.id}))`)
      : opts.where,
    [desc(tsCol), desc(idCol)],
  );
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { rows, hasMore, hasPrev: !!after };
}
