// POST /editors/reports/delete — moderator-only level delete from the
// reports queue (deleting the level cascades its reports away). Guests
// bounce to sign-in, non-mods 404. SQL: 1 session lookup + exactly 1
// indexed write (owner-or-mod predicate, stock excluded). The write pins a
// fresh D1 bookmark for replica chaining (+1 primary read on the edge), so
// the redirect back to the queue observes it. Always lands back on the
// queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { level } from "../../../db/schema";
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
    const deleted = await getRequestDb(event)
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
