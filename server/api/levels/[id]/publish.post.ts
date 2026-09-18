// POST /api/levels/:id/publish — permanently publish one of the
// signed-in user's levels. Single indexed write (RETURNING folds the
// existence check in); already-published stays published.
import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../../db/schema";
import { getRequestDb, levelWhere, requireUser } from "../../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
  const db = getRequestDb(event);
  const published = await db
    .update(level)
    .set({ published: true, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  if (!published[0]) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  return { id };
});
