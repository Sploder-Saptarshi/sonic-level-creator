// GET /api/levels/:id — fetch one of the signed-in user's levels.
import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../db/schema";
import { getRequestDb, levelWhere, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
  const db = getRequestDb(event);
  const rows = await db.select().from(level).where(levelWhere(id, user.id));
  const row = rows[0];
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return { level: row };
});
