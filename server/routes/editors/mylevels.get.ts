// GET /editors/mylevels
// The signed-in user's saved levels.
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
