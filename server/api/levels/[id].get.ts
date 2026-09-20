// GET /api/levels/:id — fetch one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed PK read (<= 1 row, full row
// needed: the editor loads `data`).
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
  const db = getRequestDb(event);
  const rows = await db.select().from(level).where(levelWhere(id, user.id));
  return { level: requireRow(rows) };
});
