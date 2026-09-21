// GET /play/:id — player for a published level (index player chrome,
// minus the isZoneOne flashvar: custom levels carry their own dimensions).
// SQL: 0 for the stock redirect; guests pay exactly 1 replica query (PK +
// name and published columns only), members add 1 session lookup. A
// replica miss with a session gets one primary retry (own rows written
// seconds ago, just-published levels); moderators then get one more
// primary query (<= 1 level + 1 report row) for unpublished levels with
// >= 1 open report. Guest misses stop at the replica (junk probes never
// touch the primary). Rows read: <= 1 level row on the hot path.
// Published hits also queue a level.played webhook as a background task
// (0 SQL, silent no-op in dev / without WEBHOOK_URL); unpublished views
// stay silent.
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
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";
import { notifyLevelPlayed } from "../../utils/webhook";

export default defineHandler(async (event) => {
  const id = getRouterParam(event, "id") ?? "";
  if (!/^[\w-]{1,128}$/.test(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  // Stock lives on the index page, not /play.
  if (id === STOCK_LEVEL_ID) return sendRedirect(event, "/");
  // Published levels play for everyone; owners can also play their own
  // unpublished levels. Moderators fall through to the reported-level
  // lookup so they can review unpublished levels with an active report.
  const session = await getSessionUser(event);
  let row = (await findVisibleLevelName(getReplicaDb(event), id, session))[0];
  if (!row && session) {
    // One primary retry for authed replica misses (read-your-write for
    // owners, just-published levels for everyone signed in); the
    // moderator reported-level fallback runs on the primary too, so a
    // just-filed report is always visible to its reviewer.
    const primary = getRequestDb(event);
    row = (await findVisibleLevelName(primary, id, session))[0];
    if (!row && session.isModerator) {
      row = (await findReportedLevelName(primary, id))[0];
    }
  }
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  // Background "played" webhook (no-op in dev / when WEBHOOK_URL is
  // unset). Published plays only — owner previews and mod-review views of
  // unpublished levels stay silent, so only published details ever leave.
  if (row.published) {
    notifyLevelPlayed(event, { id, name: row.name }, session?.username);
  }
  return html(event, renderPlayPage(row.name, id, toPageView(session, event), row.published));
});
