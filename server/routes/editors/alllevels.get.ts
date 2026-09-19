// GET /editors/alllevels — public directory of published levels.
// SQL: 0 session lookups for guests + exactly 1 app query
// (published-only metadata + author over the published index, stock
// excluded in SQL, `data` never read); signed-in adds 1 session lookup.
// No login required.
import { defineHandler } from "nitro";
import { html, renderAllLevelsPage, toPageView } from "../../utils/page";
import { getRequestDb, listPublicLevels } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  const levels = await listPublicLevels(getRequestDb(event));
  return html(
    event,
    renderAllLevelsPage({
      ...toPageView(session, event),
      levels: levels.map((l) => ({ ...l, author: l.author ?? "Player" })),
    }),
  );
});
