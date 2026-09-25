// GET /editors/alllevels — public directory of published levels.
// SQL: guests pay exactly 2 app queries (1-row stats counter read + one
// keyset page over the (published, updatedAt) index, stock excluded in
// SQL, `data` never read); signed-in adds 1 session lookup. No COUNT(*),
// no OFFSET — page depth costs nothing. Session check, counter, and page
// are mutually independent, so all three race on the one replica session
// (single bookmark floor): D1 latency costs one round trip, not three.
// Listing queries run on read replicas when available (seconds-stale at
// worst). No login required.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import {
  html,
  paginationBar,
  renderAllLevelsPage,
  toPageView,
} from "../../utils/page";
import {
  clampListingPage,
  getPublishedLevelTotal,
  getReplicaDb,
  keysetCursors,
  LEVELS_PER_PAGE,
  listPublicLevels,
  parseKeysetQuery,
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const db = getReplicaDb(event);
  const q = getQuery(event);
  // Malformed cursors fall back to the first page (never an error).
  const { incoming, keyset } = parseKeysetQuery(q);
  const [session, total, { rows: levels, hasMore, hasPrev }] = await Promise.all([
    getSessionUser(event),
    getPublishedLevelTotal(db),
    listPublicLevels(db, LEVELS_PER_PAGE, keyset),
  ]);
  // Display-only page number: rows are fetched purely from the cursor, so
  // a stale/tampered `page` can only mislabel the indicator, never skip
  // or repeat rows. Clamped so it never exceeds the counter total.
  const { page, totalPages } = clampListingPage(q.page, total);
  // Empty after-page (rows deleted since): offer the way back using the
  // incoming cursor itself as the `before` token.
  const { prevCursor, nextCursor } = keysetCursors(levels, {
    hasMore,
    hasPrev,
    incoming,
    tsOf: (l) => l.updatedAt,
    idOf: (l) => l.id,
  });
  return html(
    event,
    renderAllLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/alllevels", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
