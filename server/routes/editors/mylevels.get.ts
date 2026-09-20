// GET /editors/mylevels — the signed-in user's saved levels.
// SQL: 0 for guests (fast-path redirect), else 1 session lookup + exactly
// 2 app queries (aggregate count + one metadata-only page over the userId
// index; `data` never read). Guests resume here after sign-in via the
// attached ?next= target.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import {
  html,
  paginationBar,
  renderMyLevelsPage,
  toPageView,
} from "../../utils/page";
import {
  cleanPageParam,
  countMyLevels,
  getRequestDb,
  LEVELS_PER_PAGE,
  listMyLevelsPage,
} from "../../utils/levels";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  const db = getRequestDb(event);
  const total = await countMyLevels(db, session.id);
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  const page = Math.min(cleanPageParam(getQuery(event).page), totalPages);
  const levels = await listMyLevelsPage(
    db,
    session.id,
    LEVELS_PER_PAGE,
    (page - 1) * LEVELS_PER_PAGE,
  );
  return html(
    event,
    renderMyLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/mylevels", page, totalPages),
    ),
  );
});
