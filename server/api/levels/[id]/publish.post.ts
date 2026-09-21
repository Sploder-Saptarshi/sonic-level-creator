// POST /api/levels/:id/publish — permanently publish one of the
// signed-in user's levels. SQL: 1 session lookup + exactly 1 indexed
// write (RETURNING folds the existence check in); already-published stays
// published. Rows written: <= 1. Success pins a fresh D1 bookmark for
// replica chaining (+1 primary read on the edge), then queues a
// level.published webhook as a background task (0 SQL, silent no-op in
// dev / without WEBHOOK_URL).
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { level } from "../../../db/schema";
import {
  cleanId,
  getRequestDb,
  levelWhere,
  requireRow,
  requireUser,
} from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { enforceSameOrigin } from "../../../utils/authFlow";
import { notifyLevelPublished } from "../../../utils/webhook";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  const db = getRequestDb(event);
  const published = await db
    .update(level)
    .set({ published: true, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id, name: level.name });
  const row = requireRow(published);
  await pinFreshBookmark(event);
  // Background webhook (no-op in dev / when WEBHOOK_URL is unset).
  // Published by construction, so full details ride along.
  notifyLevelPublished(event, { id: row.id, name: row.name, author: user.username });
  return { id };
});
