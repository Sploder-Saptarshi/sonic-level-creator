// GET /editors/alllevels/:userid
// "Levels by X" (published only). Keyed by
// user id because usernames may contain spaces and punctuation.
import { defineHandler, HTTPError } from "nitro";
import { getQuery, getRouterParam } from "nitro/h3";
import {
  html,
  paginationBar,
  renderUserLevelsPage,
  toPageView,
} from "../../../utils/page";
import {
  clampListingPage,
  findUserById,
  getReplicaDb,
  isSafeId,
  keysetCursors,
  LEVELS_PER_PAGE,
  listPublicLevelsByUserId,
  parseKeysetQuery,
} from "../../../utils/levels";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const userId = getRouterParam(event, "userid") ?? "";
  if (!isSafeId(userId)) {
    throw new HTTPError({ status: 404, message: "Unknown creator" });
  }
  const db = getReplicaDb(event);
  const [session, foundRows] = await Promise.all([
    getSessionUser(event),
    findUserById(db, userId),
  ]);
  const found = foundRows[0];
  if (!found) throw new HTTPError({ status: 404, message: "Unknown creator" });
  const display = found.displayUsername ?? found.username ?? "Player";
  const total = found.publishedLevelCount ?? 0;
  if (total === 0) {
    return html(
      event,
      renderUserLevelsPage({ ...toPageView(session, event), levels: [] }, display),
    );
  }
  const q = getQuery(event);
  const { page, totalPages } = clampListingPage(q.page, total);
  const { incoming, keyset } = parseKeysetQuery(q);
  const { rows: levels, hasMore, hasPrev } = await listPublicLevelsByUserId(
    db,
    userId,
    LEVELS_PER_PAGE,
    keyset,
  );
  const { prevCursor, nextCursor } = keysetCursors(levels, {
    hasMore,
    hasPrev,
    incoming,
    tsOf: (l) => l.updatedAt,
    idOf: (l) => l.id,
  });
  const heading = levels[0]?.authorDisplay ?? levels[0]?.author ?? display;
  return html(
    event,
    renderUserLevelsPage(
      { ...toPageView(session, event), levels },
      heading,
      paginationBar(
        `/editors/alllevels/${encodeURIComponent(userId)}`,
        page,
        totalPages,
        prevCursor,
        nextCursor,
      ),
    ),
  );
});
