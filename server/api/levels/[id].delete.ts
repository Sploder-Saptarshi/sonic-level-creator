// DELETE /api/levels/:id — delete one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed level write (no select
// round-trip) + 1 report cleanup write only when the level was actually
// deleted. Rows written: <= 2 on success, 0 rows on 404 (the failed level
// delete touches nothing, and the report cleanup never runs — a forged id
// can't wipe another level's reports). Success pins a fresh D1 bookmark
// for replica chaining (+1 primary read on the edge), then queues a
// level.deleted webhook as a background task (0 SQL, silent no-op in dev /
// without WEBHOOK_URL; fires only when the deleted row was published).
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { eq } from "drizzle-orm";
import { level, report } from "../../db/schema";
import {
  cleanId,
  getRequestDb,
  levelWhere,
  requireRow,
  requireUser,
} from "../../utils/levels";
import { pinFreshBookmark } from "../../utils/replica";
import { enforceSameOrigin } from "../../utils/authFlow";
import { notifyLevelDeleted } from "../../utils/webhook";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  // Single indexed write — no separate select round-trip.
  const db = getRequestDb(event);
  const deleted = await db
    .delete(level)
    .where(levelWhere(id, user.id))
    .returning({ id: level.id, name: level.name, published: level.published });
  const row = requireRow(deleted);
  // Explicit report cleanup AFTER the ownership-checked delete: D1 cannot
  // rely on per-connection PRAGMA foreign_keys state, so ON DELETE CASCADE
  // may not fire there. Scoped to the just-deleted row id, so it only runs
  // on success — harmless where cascades do fire (zero rows left to
  // delete), and the counter triggers observe the deletes on every path.
  await db.delete(report).where(eq(report.levelId, row.id));
  await pinFreshBookmark(event);
  // Background webhook (no-op in dev / when WEBHOOK_URL is unset).
  // Fires only when the deleted row was published.
  notifyLevelDeleted(event, {
    id: row.id,
    name: row.name,
    published: row.published,
    author: user.username,
    actor: user.username,
  });
  return { id };
});
