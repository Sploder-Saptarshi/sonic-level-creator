// GET /editors/reports — moderator-only queue of reported levels.
// SQL: 1 session lookup + 1-row stats counter read (trigger-kept
// open_reports); the listing query runs only when the queue is non-empty
// (one keyset page over the (status, createdAt) index, `data` never
// read). No COUNT(*), no OFFSET. Stays sequential on purpose: the
// moderator gate must precede any listing read, and the empty-queue
// short-circuit avoids a wasted page fetch — unlike the public listings,
// there is nothing independent to race here. Listing queries run on read
// replicas when available (a just-filed report appears seconds later at
// worst). Guests bounce to sign-in; signed-in non-moderators get a 404
// (the page must not reveal its existence).
import { defineHandler, HTTPError } from "nitro";
import { getQuery } from "nitro/h3";
import { html, paginationBar, renderReportsPage, toPageView } from "../../utils/page";
import {
  clampListingPage,
  getOpenReportTotal,
  getReplicaDb,
  keysetCursors,
  LEVELS_PER_PAGE,
  listOpenReports,
  parseKeysetQuery,
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
  // Display-only page number: rows are fetched purely from the cursor.
  // Note the cursor pins (createdAt, reportId) — grouping by level happens
  // after the fetch, so page edges may split a level's reports across
  // pages (same as the old OFFSET edges did).
  const q = getQuery(event);
  const { page, totalPages } = clampListingPage(q.page, total);
  const { incoming, keyset } = parseKeysetQuery(q);
  const { rows: reports, hasMore, hasPrev } = await listOpenReports(
    db,
    LEVELS_PER_PAGE,
    keyset,
  );
  const { prevCursor, nextCursor } = keysetCursors(reports, {
    hasMore,
    hasPrev,
    incoming,
    tsOf: (r) => r.createdAt,
    idOf: (r) => r.reportId,
  });
  return html(
    event,
    renderReportsPage(
      { ...toPageView(session, event), reports },
      paginationBar("/editors/reports", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
