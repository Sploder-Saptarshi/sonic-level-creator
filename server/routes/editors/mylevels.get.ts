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
  cleanCursorParam,
  cleanPageParam,
  cursorFor,
  encodePageCursor,
  getMyLevelTotal,
  getReplicaDb,
  LEVELS_PER_PAGE,
  listMyLevelsPage,
} from "../../utils/levels";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  const db = getReplicaDb(event);
  const q = getQuery(event);
  const after = cleanCursorParam(q.after);
  const incoming = after ?? cleanCursorParam(q.before);
  const [total, { rows: levels, hasMore, hasPrev }] = await Promise.all([
    getMyLevelTotal(db, session.id),
    listMyLevelsPage(
      db,
      session.id,
      LEVELS_PER_PAGE,
      after ? { after } : incoming ? { before: incoming } : {},
    ),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  // Display-only page number: rows are fetched purely from the cursor.
  const page = Math.min(Math.max(cleanPageParam(q.page), 1), totalPages);
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
    renderMyLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/mylevels", page, totalPages, prevCursor, nextCursor),
    ),
  );
});
