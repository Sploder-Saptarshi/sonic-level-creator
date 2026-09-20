// DELETE /api/levels/:id — delete one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed write (no select round-trip).
// Rows written: <= 1.
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

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  // Single indexed write — no separate select round-trip.
  const db = getRequestDb(event);
  const deleted = await db
    .delete(level)
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  requireRow(deleted);
  return { id };
});
