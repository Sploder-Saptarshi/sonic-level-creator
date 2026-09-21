// GET /editors/alllevels/:userid — per-user directory ("Levels by X"),
// linked from author names in All Levels. Published levels only.
// Keyed by user id (stable when usernames later gain spaces/punctuation/
// capitals); the heading shows the pretty-case username.
// SQL: guests pay exactly 2 app queries (aggregate count + one page over
// the userId index, stock excluded in SQL, `data` never read). The joined
// user columns supply the heading — no extra lookup while pages have
// rows; empty results add 1 user PK lookup (unknown ids 404, creators with
// no published levels render empty). Listing queries run on read replicas
// when available (seconds-stale at worst). Signed-in adds 1 session lookup.
// No login required.
import { defineHandler, HTTPError } from "nitro";
import { getQuery, getRouterParam } from "nitro/h3";
import {
  html,
  paginationBar,
  renderUserLevelsPage,
  toPageView,
} from "../../../utils/page";
import {
  cleanPageParam,
  countPublicLevelsByUserId,
  findUserById,
  getReplicaDb,
  LEVELS_PER_PAGE,
  listPublicLevelsByUserId,
} from "../../../utils/levels";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const userId = getRouterParam(event, "userid") ?? "";
  if (!/^[\w-]{1,128}$/.test(userId)) {
    throw new HTTPError({ status: 404, message: "Unknown creator" });
  }
  const session = await getSessionUser(event);
  const db = getReplicaDb(event);
  const total = await countPublicLevelsByUserId(db, userId);
  // Unknown ids 404 even with zero rows; known creators render empty.
  if (total === 0) {
    const found = (await findUserById(db, userId))[0];
    if (!found) throw new HTTPError({ status: 404, message: "Unknown creator" });
    const display = found.displayUsername ?? found.username ?? "Player";
    return html(
      event,
      renderUserLevelsPage({ ...toPageView(session, event), levels: [] }, display),
    );
  }
  const totalPages = Math.ceil(total / LEVELS_PER_PAGE);
  const page = Math.min(cleanPageParam(getQuery(event).page), totalPages);
  const levels = await listPublicLevelsByUserId(
    db,
    userId,
    LEVELS_PER_PAGE,
    (page - 1) * LEVELS_PER_PAGE,
  );
  // Heading from the already-joined user columns: 0 extra SQL.
  const first = levels[0]!;
  const display = first.authorDisplay ?? first.author ?? "Player";
  return html(
    event,
    renderUserLevelsPage(
      { ...toPageView(session, event), levels },
      display,
      paginationBar(
        `/editors/alllevels/${encodeURIComponent(userId)}`,
        page,
        totalPages,
      ),
    ),
  );
});
