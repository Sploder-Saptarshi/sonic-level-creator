// GET /editors/alllevels/:userid — per-user directory ("Levels by X"),
// linked from author names in All Levels. Published levels only.
// Keyed by user id (stable when usernames later gain spaces/punctuation/
// capitals); the heading shows the pretty-case username.
// SQL: guests pay exactly 2 app queries (1-row user PK read carrying both
// the heading and the trigger-kept published counter, + one keyset page
// over the (userId, published, updatedAt) index, stock excluded in SQL,
// `data` never read). Unknown ids 404 even with zero rows; known creators
// render empty. No COUNT(*), no OFFSET. Listing queries run on read
// replicas when available (seconds-stale at worst). Signed-in adds 1
// session lookup. No login required.
import { defineHandler, HTTPError } from "nitro";
import { getQuery, getRouterParam } from "nitro/h3";
import {
  html,
  paginationBar,
  renderUserLevelsPage,
  toPageView,
} from "../../../utils/page";
import {
  cleanCursorParam,
  cleanPageParam,
  cursorFor,
  encodePageCursor,
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
  // Existence, heading name, and page total in a single PK row.
  const found = (await findUserById(db, userId))[0];
  if (!found) throw new HTTPError({ status: 404, message: "Unknown creator" });
  const display = found.displayUsername ?? found.username ?? "Player";
  const total = found.publishedLevelCount ?? 0;
  if (total === 0) {
    return html(
      event,
      renderUserLevelsPage({ ...toPageView(session, event), levels: [] }, display),
    );
  }
  const totalPages = Math.ceil(total / LEVELS_PER_PAGE);
  // Display-only page number: rows are fetched purely from the cursor.
  const q = getQuery(event);
  const page = Math.min(Math.max(cleanPageParam(q.page), 1), totalPages);
  const after = cleanCursorParam(q.after);
  const incoming = after ?? cleanCursorParam(q.before);
  const { rows: levels, hasMore, hasPrev } = await listPublicLevelsByUserId(
    db,
    userId,
    LEVELS_PER_PAGE,
    after ? { after } : incoming ? { before: incoming } : {},
  );
  const prevCursor =
    levels.length > 0
      ? hasPrev
        ? cursorFor(levels[0]!.updatedAt, levels[0]!.id)
        : null
      : incoming
        ? encodePageCursor(incoming.ts, incoming.id)
        : null;
  const last = levels[levels.length - 1];
  const nextCursor =
    last && hasMore ? cursorFor(last.updatedAt, last.id) : null;
  // Heading from the page rows when present (same as before), else the
  // already-fetched user row: still 0 extra SQL either way.
  const heading = levels.length > 0
    ? (levels[0]!.authorDisplay ?? levels[0]!.author ?? display)
    : display;
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
