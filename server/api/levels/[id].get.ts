// GET /api/levels/:id — fetch one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed replica PK read (<= 1 row,
// full row needed: the editor loads `data`). A replica miss gets one
// primary retry (levels saved seconds ago); mutations pin bookmarks so
// the retry is rarely needed.
import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { level } from "../../db/schema";
import {
  cleanId,
  getReplicaDb,
  getRequestDb,
  levelWhere,
  requireRow,
  requireUser,
} from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  let rows = await getReplicaDb(event).select().from(level).where(levelWhere(id, user.id));
  if (!rows[0]) {
    rows = await getRequestDb(event).select().from(level).where(levelWhere(id, user.id));
  }
  return { level: requireRow(rows) };
});
