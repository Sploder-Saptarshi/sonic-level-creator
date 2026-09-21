// POST /editors/reports/delete — moderator-only level delete from the
// reports queue (deleting the level cascades its reports away where FK
// enforcement is on; an explicit report delete below covers paths where
// it is not). Guests bounce to sign-in, non-mods 404. SQL: 1 session
// lookup + 1 report cleanup write + exactly 1 indexed level write
// (owner-or-mod predicate, stock excluded). The write pins a fresh D1
// bookmark for replica chaining (+1 primary read on the edge), so the
// redirect back to the queue observes it. Always lands back on the queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { eq } from "drizzle-orm";
import { level, report } from "../../../db/schema";
import { cleanId, getRequestDb, levelWhereForUser } from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";
import { notifyLevelDeleted } from "../../../utils/webhook";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) {
    const db = getRequestDb(event);
    // Explicit report cleanup first (see api/levels/[id].delete.ts).
    await db.delete(report).where(eq(report.levelId, id));
    const deleted = await db
      .delete(level)
      .where(levelWhereForUser(id, session))
      .returning({ id: level.id, name: level.name, published: level.published });
    await pinFreshBookmark(event);
    // Background webhook (no-op in dev / when WEBHOOK_URL is unset).
    // Fires only when the deleted row was published.
    const row = deleted[0];
    if (row) {
      notifyLevelDeleted(event, {
        id: row.id,
        name: row.name,
        published: row.published,
        actor: session.username,
      });
    }
  }
  return sendRedirect(event, "/editors/reports");
});
