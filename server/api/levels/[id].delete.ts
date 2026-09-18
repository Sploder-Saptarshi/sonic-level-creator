// DELETE /api/levels/:id — delete one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed write (no select round-trip).
// Rows written: <= 1.
import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { level } from "../../db/schema";
import {
  getRequestDb,
  levelWhere,
  requireRow,
  requireUser,
} from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
  // Single indexed write — no separate select round-trip.
  const db = getRequestDb(event);
  const deleted = await db
    .delete(level)
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  requireRow(deleted);
  return { id };
});
