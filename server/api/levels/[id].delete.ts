// DELETE /api/levels/:id — delete one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed write (no select round-trip).
// Rows written: <= 1. Success pins a fresh D1 bookmark for replica
// chaining (+1 primary read on the edge), then queues a level.deleted
// webhook as a background task (0 SQL, silent no-op in dev / without
// WEBHOOK_URL; fires only when the deleted row was published).
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { level } from "../../db/schema";
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
