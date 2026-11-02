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
  const { incoming, keyset } = parseKeysetQuery(q);
  const [session, total, { rows: levels, hasMore, hasPrev }] = await Promise.all([
    getSessionUser(event),
    getPublishedLevelTotal(db),
    listPublicLevels(db, LEVELS_PER_PAGE, keyset),
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
    renderAllLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/alllevels", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
