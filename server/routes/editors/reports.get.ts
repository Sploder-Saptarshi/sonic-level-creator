// GET /editors/reports — moderator-only queue of reported levels.
// SQL: 1 session lookup + 1 aggregate count (0 rows read); the listing
// query runs only when the queue is non-empty (one index-walked page,
// `data` never read). Guests bounce to sign-in; signed-in non-moderators
// get a 404 (the page must not reveal its existence).
import { defineHandler, HTTPError } from "nitro";
import { getQuery } from "nitro/h3";
import { html, paginationBar, renderReportsPage, toPageView } from "../../utils/page";
import {
  cleanPageParam,
  countOpenReports,
  getRequestDb,
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
  const db = getRequestDb(event);
  const total = await countOpenReports(db);
  if (total === 0) {
    return html(event, renderReportsPage({ ...toPageView(session, event), reports: [] }));
  }
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  const page = Math.min(cleanPageParam(getQuery(event).page), totalPages);
  const reports = await listOpenReports(
    db,
    LEVELS_PER_PAGE,
    (page - 1) * LEVELS_PER_PAGE,
  );
  return html(
    event,
    renderReportsPage(
      { ...toPageView(session, event), reports },
      paginationBar("/editors/reports", page, totalPages),
    ),
  );
});
