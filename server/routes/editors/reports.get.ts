// GET /editors/reports — moderator-only queue of reported levels.
// SQL: 1 session lookup + 1-row stats counter read (trigger-kept
// open_reports); the listing query runs only when the queue is non-empty
// (one keyset page over the (status, createdAt) index, `data` never
// read). No COUNT(*), no OFFSET. Listing queries run on read replicas
// when available (a just-filed report appears seconds later at worst).
// Guests bounce to sign-in; signed-in non-moderators get a 404 (the page
// must not reveal its existence).
import { defineHandler, HTTPError } from "nitro";
import { getQuery } from "nitro/h3";
import { html, paginationBar, renderReportsPage, toPageView } from "../../utils/page";
import {
  cleanCursorParam,
  cleanPageParam,
  cursorFor,
  encodePageCursor,
  getOpenReportTotal,
  getReplicaDb,
  LEVELS_PER_PAGE,
  listOpenReports,
} from "../../utils/levels";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
  const db = getReplicaDb(event);
  const total = await getOpenReportTotal(db);
  if (total === 0) {
    return html(event, renderReportsPage({ ...toPageView(session, event), reports: [] }));
  }
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  // Display-only page number: rows are fetched purely from the cursor.
  // Note the cursor pins (createdAt, reportId) — grouping by level happens
  // after the fetch, so page edges may split a level's reports across
  // pages (same as the old OFFSET edges did).
  const q = getQuery(event);
  const page = Math.min(Math.max(cleanPageParam(q.page), 1), totalPages);
  const after = cleanCursorParam(q.after);
  const incoming = after ?? cleanCursorParam(q.before);
  const { rows: reports, hasMore, hasPrev } = await listOpenReports(
    db,
    LEVELS_PER_PAGE,
    after ? { after } : incoming ? { before: incoming } : {},
  );
  const prevCursor =
    reports.length > 0
      ? hasPrev
        ? cursorFor(reports[0]!.createdAt, reports[0]!.reportId)
        : null
      : incoming
        ? encodePageCursor(incoming.ts, incoming.id)
        : null;
  const last = reports[reports.length - 1];
  const nextCursor =
    last && hasMore ? cursorFor(last.createdAt, last.reportId) : null;
  return html(
    event,
    renderReportsPage(
      { ...toPageView(session, event), reports },
      paginationBar("/editors/reports", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
