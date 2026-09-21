// GET /play/:id — player for a published level (index player chrome,
// minus the isZoneOne flashvar: custom levels carry their own dimensions).
// SQL: 0 for the stock redirect; guests pay exactly 1 app query (PK + name
// and published columns only), members add 1 session lookup. Moderators
// get one extra query (<= 1 level + 1 report row) only when the first
// lookup misses — i.e. an unpublished level they don't own with >= 1 open
// report. Rows read: <= 1 level row on the hot path.
import { defineHandler } from "nitro";
import { getRouterParam, sendRedirect } from "nitro/h3";
import { HTTPError } from "nitro";
import { html, renderPlayPage, toPageView } from "../../utils/page";
import {
  STOCK_LEVEL_ID,
  findReportedLevelName,
  findVisibleLevelName,
  getRequestDb,
  requireRow,
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const id = getRouterParam(event, "id") ?? "";
  if (!/^[\w-]{1,128}$/.test(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  // Stock lives on the index page, not /play.
  if (id === STOCK_LEVEL_ID) return sendRedirect(event, "/");
  // Published levels play for everyone; owners can also play their own
  // unpublished levels (single indexed query either way). Moderators fall
  // through to the reported-level lookup so they can review unpublished
  // levels with an active report.
  const session = await getSessionUser(event);
  const db = getRequestDb(event);
  const rows = await findVisibleLevelName(db, id, session);
  if (rows[0]) {
    const row = requireRow(rows);
    return html(event, renderPlayPage(row.name, id, toPageView(session, event), row.published));
  }
  if (session?.isModerator) {
    const reported = await findReportedLevelName(db, id);
    const row = requireRow(reported);
    return html(event, renderPlayPage(row.name, id, toPageView(session, event), row.published));
  }
  throw new HTTPError({ status: 404, message: "Level not found" });
});
