import { defineHandler, HTTPError } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { listingPagination, renderReportsPage } from "../../utils/page/lists";
import { LEVELS_PER_PAGE, readListingQuery } from "../../utils/pagination";
import { getOpenReportTotal, listOpenReports } from "../../utils/reports";
import { getReplicaDb } from "../../utils/db";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  // 404 rather than 403 so the page's existence isn't revealed
  if (!session.isModerator) throw new HTTPError({ status: 404, message: "Not found" });
  const db = getReplicaDb(event);
  const view = toPageView(session, event);
  const total = await getOpenReportTotal(db);
  if (total === 0) return html(event, renderReportsPage({ ...view, reports: [] }));

  const query = readListingQuery(event);
  const result = await listOpenReports(db, LEVELS_PER_PAGE, query.keyset);
  const pagination = listingPagination("/editors/reports", query, total, result, (r) => ({ ts: r.createdAt, id: r.reportId }));
  return html(event, renderReportsPage({ ...view, reports: result.rows }, pagination));
});
