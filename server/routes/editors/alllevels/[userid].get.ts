// GET /editors/alllevels/:userid — per-user directory ("Levels by X"),
// linked from author names in All Levels. Published levels only.
// Keyed by user id (stable when usernames later gain spaces/punctuation/
// capitals); the heading shows the pretty-case username.
// SQL: guests pay exactly 1 app query when the user has published levels
// (the joined user columns supply the heading — no second lookup),
// +1 user PK lookup when empty (unknown ids 404, creators with no
// published levels render empty). Signed-in adds 1 session lookup.
// No login required.
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { html, renderUserLevelsPage, toPageView } from "../../../utils/page";
import {
  findUserById,
  getRequestDb,
  listPublicLevelsByUserId,
} from "../../../utils/levels";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const userId = getRouterParam(event, "userid") ?? "";
  if (!/^[\w-]{1,128}$/.test(userId)) {
    throw new HTTPError({ status: 404, message: "Unknown creator" });
  }
  const session = await getSessionUser(event);
  const db = getRequestDb(event);
  const levels = await listPublicLevelsByUserId(db, userId);
  if (levels.length) {
    // Heading from the already-joined user columns: 0 extra SQL.
    const first = levels[0]!;
    const display = first.authorDisplay ?? first.author ?? "Player";
    return html(
      event,
      renderUserLevelsPage({ ...toPageView(session, event), levels }, display),
    );
  }
  // Empty listing: unknown ids 404, known creators render the empty page.
  const found = (await findUserById(db, userId))[0];
  if (!found) throw new HTTPError({ status: 404, message: "Unknown creator" });
  const display = found.displayUsername ?? found.username ?? "Player";
  return html(
    event,
    renderUserLevelsPage({ ...toPageView(session, event), levels: [] }, display),
  );
});
