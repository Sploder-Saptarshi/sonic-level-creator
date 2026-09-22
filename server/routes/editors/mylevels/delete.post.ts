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
  if (!session) return redirectToSignin(event, "/editors/mylevels");
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) {
    const db = getRequestDb(event);
    const deleted = await db
      .delete(level)
      .where(levelWhereForUser(id, session))
      .returning({ id: level.id, name: level.name, published: level.published });
    // Report cleanup AFTER the ownership-checked delete, scoped to the
    // just-deleted row (see api/levels/[id].delete.ts): D1 cannot rely on
    // PRAGMA foreign_keys, so the cascade may not fire — and running it
    // before would let a forged id wipe another level's reports.
    const row = deleted[0];
    if (row) {
      await db.delete(report).where(eq(report.levelId, row.id));
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
