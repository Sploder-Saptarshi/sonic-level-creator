// POST /api/levels/:id/publish — permanently publish one of the
// signed-in user's levels. SQL: 1 session lookup + exactly 1 indexed
// write (RETURNING folds the existence check in); already-published stays
// published. Rows written: <= 1. Success pins a fresh D1 bookmark for
// replica chaining (+1 primary read on the edge).
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
    .returning({ id: level.id });
  requireRow(published);
  await pinFreshBookmark(event);
  return { id };
});
