// GET /play/:id — player for a published level (index player chrome,
// minus the isZoneOne flashvar: custom levels carry their own dimensions).
// SQL: 0 for the stock redirect; guests pay exactly 1 app query (PK + name
// column only), members add 1 session lookup. Rows read: <= 1 level row.
import { defineHandler } from "nitro";
import { getRouterParam, sendRedirect } from "nitro/h3";
import { HTTPError } from "nitro";
import { html, renderPlayPage, toPageView } from "../../utils/page";
import {
  STOCK_LEVEL_ID,
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
  // unpublished levels (single indexed query either way).
  const session = await getSessionUser(event);
  const rows = await findVisibleLevelName(getRequestDb(event), id, session);
  const row = requireRow(rows);
  return html(event, renderPlayPage(row.name, id, toPageView(session, event)));
});
