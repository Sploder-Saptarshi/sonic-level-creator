// GET /editors/alllevels — public directory of published levels.
// Exactly 1 app query: published-only metadata over the published index,
// joined to the author name. No login required.
import { defineHandler } from "nitro";
import { desc, eq } from "drizzle-orm";
import { setResponseHeader } from "nitro/h3";
import { level, user } from "../../db/schema";
import { renderAllLevelsPage, userLanguageBar } from "../../utils/page";
import { getRequestDb } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  const session = await getSessionUser(event);
  const db = getRequestDb(event);
  const levels = await db
    .select({
      id: level.id,
      name: level.name,
      author: user.username,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .innerJoin(user, eq(level.userId, user.id))
    .where(eq(level.published, true))
    .orderBy(desc(level.updatedAt));
  return renderAllLevelsPage({
    ...(session
      ? {
        username: session.username,
        languagebar: userLanguageBar(session.username),
      }
      : {}),
    levels: levels.map((l) => ({ ...l, author: l.author ?? "Player" })),
  });
});
