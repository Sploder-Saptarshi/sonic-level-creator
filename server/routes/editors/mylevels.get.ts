// GET /editors/mylevels — the signed-in user's saved levels.
// Exactly 1 app query (metadata-only list over the userId index).
import { defineHandler } from "nitro";
import { desc, eq } from "drizzle-orm";
import { sendRedirect, setResponseHeader } from "nitro/h3";
import { level } from "../../db/schema";
import { renderMyLevelsPage, userLanguageBar } from "../../utils/page";
import { getRequestDb } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  const session = await getSessionUser(event);
  if (!session) return sendRedirect(event, "/member/signin");
  const db = getRequestDb(event);
  const levels = await db
    .select({
      id: level.id,
      name: level.name,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .where(eq(level.userId, session.id))
    .orderBy(desc(level.updatedAt));
  return renderMyLevelsPage({
    username: session.username,
    languagebar: userLanguageBar(session.username),
    levels,
  });
});
