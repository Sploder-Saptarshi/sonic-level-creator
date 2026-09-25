// DELETE /api/levels/:id — delete one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed level write (no select
// round-trip) + 1 report cleanup write only when the level was actually
// deleted. Rows written: <= 2 on success, 0 rows on 404 (the failed level
// delete touches nothing, and the report cleanup never runs — a forged id
// can't wipe another level's reports). Success pins a fresh D1 bookmark
// for replica chaining (+1 primary read on the edge), then queues a
// level.deleted webhook as a background task (0 SQL, silent no-op in dev /
// without WEBHOOK_URL; fires only when the deleted row was published).
import { defineHandler } from "nitro";
import {
  deleteLevelWithReports,
  getRequestDb,
  levelWhere,
  requireRow,
  requireUserAndLevelId,
} from "../../utils/levels";
import { pinFreshBookmark } from "../../utils/replica";
import { notifyLevelDeleted } from "../../utils/webhook";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event);
  // Single indexed write — no separate select round-trip. Report cleanup
  // runs inside the helper, scoped to the just-deleted row (see
  // deleteLevelWithReports).
  const deleted = await deleteLevelWithReports(
    getRequestDb(event),
    levelWhere(id, user.id),
  );
  const row = requireRow(deleted);
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
