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
