// GET /play/:id — player for a published level (index player chrome,
// minus the isZoneOne flashvar: custom levels carry their own dimensions).
// Exactly 1 app query (PK lookup + published check).
import { defineHandler } from "nitro";
import { and, eq } from "drizzle-orm";
import { getRouterParam, sendRedirect, setResponseHeader } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../db/schema";
import { renderPlayPage, userLanguageBar } from "../../utils/page";
import { STOCK_LEVEL_ID, getRequestDb } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  const id = getRouterParam(event, "id") ?? "";
  if (!/^[\w-]{1,128}$/.test(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  // Stock lives on the index page, not /play.
  if (id === STOCK_LEVEL_ID) return sendRedirect(event, "/");
  const db = getRequestDb(event);
  const rows = await db
    .select({ name: level.name })
    .from(level)
    .where(and(eq(level.id, id), eq(level.published, true)));
  if (!rows[0]) throw new HTTPError({ status: 404, message: "Level not found" });
  const session = await getSessionUser(event);
  return renderPlayPage(
    rows[0].name,
    id,
    session
      ? {
        username: session.username,
        languagebar: userLanguageBar(session.username),
      }
      : {},
  );
});
