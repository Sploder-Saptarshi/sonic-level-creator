// GET /api/levels/:id
// Fetch one of the signed-in user's levels. A replica
// miss retries on the primary (levels saved seconds ago).
import { defineHandler } from "nitro";
import { level } from "../../db/schema";
import {
  getReplicaDb,
  getRequestDb,
  levelWhere,
  requireRow,
  requireUserAndLevelId,
} from "../../utils/levels";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event, { sameOrigin: false });
  let rows = await getReplicaDb(event).select().from(level).where(levelWhere(id, user.id));
  if (!rows[0]) {
    rows = await getRequestDb(event).select().from(level).where(levelWhere(id, user.id));
  }
  return { level: requireRow(rows) };
});
