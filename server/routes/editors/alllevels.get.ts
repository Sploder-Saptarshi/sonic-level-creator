// GET /editors/alllevels — public directory of published levels.
// SQL: guests pay exactly 2 app queries (1-row stats counter read + one
// keyset page over the (published, updatedAt) index, stock excluded in
// SQL, `data` never read); signed-in adds 1 session lookup. No COUNT(*),
// no OFFSET — page depth costs nothing. Listing queries run on read
// replicas when available (seconds-stale at worst). No login required.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import {
  html,
  paginationBar,
  renderAllLevelsPage,
  toPageView,
} from "../../utils/page";
import {
  cleanCursorParam,
  cleanPageParam,
  cursorFor,
  encodePageCursor,
  getPublishedLevelTotal,
  getReplicaDb,
  LEVELS_PER_PAGE,
  listPublicLevels,
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  const db = getReplicaDb(event);
  const total = await getPublishedLevelTotal(db);
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  // Display-only page number: rows are fetched purely from the cursor, so
  // a stale/tampered `page` can only mislabel the indicator, never skip
  // or repeat rows. Clamped so it never exceeds the counter total.
  const q = getQuery(event);
  const page = Math.min(Math.max(cleanPageParam(q.page), 1), totalPages);
  const after = cleanCursorParam(q.after);
  // Malformed cursors fall back to the first page (never an error).
  const incoming = after ?? cleanCursorParam(q.before);
  const { rows: levels, hasMore, hasPrev } = await listPublicLevels(
    db,
    LEVELS_PER_PAGE,
    after ? { after } : incoming ? { before: incoming } : {},
  );
  // Empty after-page (rows deleted since): offer the way back using the
  // incoming cursor itself as the `before` token.
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
  return html(
    event,
    renderAllLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/alllevels", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
