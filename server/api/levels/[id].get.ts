// GET /api/levels/:id — fetch one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed PK read (<= 1 row, full row
// needed: the editor loads `data`).
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
  const db = getRequestDb(event);
  const rows = await db.select().from(level).where(levelWhere(id, user.id));
  return { level: requireRow(rows) };
});
