// POST /editors/reports/delete — moderator-only level delete from the
// reports queue (deleting the level cascades its reports away where FK
// enforcement is on; an explicit report delete below covers paths where
// it is not). Guests bounce to sign-in, non-mods 404. SQL: 1 session
// lookup + exactly 1 indexed level write (owner-or-mod predicate, stock
// excluded) + 1 report cleanup write only when the level was actually
// deleted. The write pins a fresh D1 bookmark for replica chaining (+1
// primary read on the edge, success only), so the redirect back to the
// queue observes it. Always lands back on the queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId, deleteLevelWithReports, getRequestDb, levelWhereForUser } from "../../../utils/levels";
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
    const deleted = await deleteLevelWithReports(
      getRequestDb(event),
      levelWhereForUser(id, session),
    );
    // The cleanup runs inside the helper, scoped to the just-deleted row
    // (see deleteLevelWithReports) — a stock/excluded id that deletes 0
    // level rows touches no reports either.
    const row = deleted[0];
    if (row) {
      await pinFreshBookmark(event);
      // Background webhook (no-op in dev / when WEBHOOK_URL is unset).
      // Fires only when the deleted row was published.
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
