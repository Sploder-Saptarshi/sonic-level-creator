// GET /play/:id
// Level player. Published levels play for everyone, owners
// also see their unpublished ones, and moderators can review reported ones.
// Plays are counted at the gateway, not here (crawlers would inflate them).
import { defineHandler } from "nitro";
import { getRouterParam, sendRedirect } from "nitro/h3";
import { HTTPError } from "nitro";
import { html, renderPlayPage, toPageView } from "../../utils/page";
import {
  STOCK_LEVEL_ID,
  findReportedLevelName,
  findVisibleLevelName,
  getReplicaDb,
  getRequestDb,
  isSafeId,
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const id = getRouterParam(event, "id") ?? "";
  if (!isSafeId(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  if (id === STOCK_LEVEL_ID) return sendRedirect(event, "/");
  const session = await getSessionUser(event);
  let row = (await findVisibleLevelName(getReplicaDb(event), id, session))[0];
  if (!row && session) {
    // Signed-in misses retry on the primary (read-your-writes); guests and
    // junk probes stop at the replica.
    const primary = getRequestDb(event);
    row = (await findVisibleLevelName(primary, id, session))[0];
    if (!row && session.isModerator) {
      row = (await findReportedLevelName(primary, id))[0];
    }
  }
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return html(event, renderPlayPage(row.name, id, toPageView(session, event), row.published));
});
