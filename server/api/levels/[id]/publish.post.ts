// POST /api/levels/:id/publish — permanently publish one of the
// signed-in user's levels. SQL: 1 session lookup + exactly 1 indexed
// write (RETURNING folds the existence check in); already-published stays
// published. Rows written: <= 1.
import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { level } from "../../../db/schema";
import {
  getRequestDb,
  levelWhere,
  requireRow,
  requireUser,
} from "../../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
  const db = getRequestDb(event);
  const published = await db
    .update(level)
    .set({ published: true, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  requireRow(published);
  return { id };
});
