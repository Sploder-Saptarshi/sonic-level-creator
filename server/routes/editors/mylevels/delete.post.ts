// POST /editors/mylevels/delete — ownership-checked delete (moderators may
// delete any level). SQL: 0 for guests (fast-path redirect), else 1 session
// lookup + exactly 1 indexed level write (RETURNING folds the existence
// check in, no select round-trip) + 1 report cleanup write only when the
// level was actually deleted. Rows written: <= 2 on success, 0 rows
// otherwise (a forged id can't wipe another level's reports). The write
// pins a fresh D1 bookmark for replica chaining (+1 primary read on the
// edge, success only), so the redirect back to My Levels observes it.
// Guests land on My Levels after sign-in (the POST endpoint itself isn't
// landable, so no ?next= to it).
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId, deleteLevelWithReports, getRequestDb, levelWhereForUser } from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";
import { notifyLevelDeleted } from "../../../utils/webhook";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/mylevels");
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) {
    const deleted = await deleteLevelWithReports(
      getRequestDb(event),
      levelWhereForUser(id, session),
    );
    // The cleanup runs inside the helper, scoped to the just-deleted row
    // (see deleteLevelWithReports): a forged id deletes 0 rows and touches
    // nothing.
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
  return sendRedirect(event, "/editors/mylevels");
});
