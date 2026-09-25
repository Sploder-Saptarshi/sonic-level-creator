// GET /editors/mylevels — the signed-in user's saved levels.
// SQL: 0 for guests (fast-path redirect), else 1 session lookup + exactly
// 2 replica queries (1-row user.level_count counter read + one keyset page
// of metadata over the (userId, updatedAt) index; `data` never read).
// Counter and page are independent, so both race on the one replica
// session: one round trip instead of two. No COUNT(*), no OFFSET.
// Mutations pin bookmarks, so the redirect back here after
// create/rename/delete/publish observes the write. Guests resume here
// after sign-in via the attached ?next= target.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import {
  html,
  paginationBar,
  renderMyLevelsPage,
  toPageView,
} from "../../utils/page";
import {
  clampListingPage,
  getMyLevelTotal,
  getReplicaDb,
  keysetCursors,
  LEVELS_PER_PAGE,
  listMyLevelsPage,
  parseKeysetQuery,
} from "../../utils/levels";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  const db = getReplicaDb(event);
  const q = getQuery(event);
  const { incoming, keyset } = parseKeysetQuery(q);
  const [total, { rows: levels, hasMore, hasPrev }] = await Promise.all([
    getMyLevelTotal(db, session.id),
    listMyLevelsPage(db, session.id, LEVELS_PER_PAGE, keyset),
  ]);
  const { page, totalPages } = clampListingPage(q.page, total);
  // Display-only page number: rows are fetched purely from the cursor.
  const { prevCursor, nextCursor } = keysetCursors(levels, {
    hasMore,
    hasPrev,
    incoming,
    tsOf: (l) => l.updatedAt,
    idOf: (l) => l.id,
  });
  return html(
    event,
    renderMyLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/mylevels", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
