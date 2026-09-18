// DELETE /api/levels/:id — delete one of the signed-in user's levels.
import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../db/schema";
import { getRequestDb, levelWhere, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
  // Single indexed write — no separate select round-trip.
  const db = getRequestDb(event);
  const deleted = await db
    .delete(level)
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  if (!deleted[0]) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  return { id };
});
