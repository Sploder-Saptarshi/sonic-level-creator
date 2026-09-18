// GET /editors/mylevels — the signed-in user's saved levels.
// SQL: 0 for guests (fast-path redirect), else 1 session lookup + exactly
// 1 app query (metadata-only list over the userId index; `data` never read).
import { defineHandler } from "nitro";
import { sendRedirect } from "nitro/h3";
import { html, renderMyLevelsPage, toPageView } from "../../utils/page";
import { getRequestDb, listMyLevels } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return sendRedirect(event, "/member/signin");
  const levels = await listMyLevels(getRequestDb(event), session.id, true);
  return html(event, renderMyLevelsPage({ ...toPageView(session), levels }));
});
