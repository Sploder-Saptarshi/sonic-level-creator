// GET /editors/alllevels — public directory of published levels.
// SQL: guests pay exactly 2 app queries (aggregate count + one page over
// the published index, stock excluded in SQL, `data` never read); signed-in
// adds 1 session lookup. No login required.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import {
  html,
  paginationBar,
  renderAllLevelsPage,
  toPageView,
} from "../../utils/page";
import {
  cleanPageParam,
  countPublicLevels,
  getRequestDb,
  LEVELS_PER_PAGE,
  listPublicLevels,
} from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  const db = getRequestDb(event);
  const total = await countPublicLevels(db);
  const totalPages = Math.max(1, Math.ceil(total / LEVELS_PER_PAGE));
  const page = Math.min(cleanPageParam(getQuery(event).page), totalPages);
  const levels = await listPublicLevels(
    db,
    LEVELS_PER_PAGE,
    (page - 1) * LEVELS_PER_PAGE,
  );
  return html(
    event,
    renderAllLevelsPage(
      { ...toPageView(session, event), levels },
      total === 0 ? "" : paginationBar("/editors/alllevels", page, totalPages),
    ),
  );
});
