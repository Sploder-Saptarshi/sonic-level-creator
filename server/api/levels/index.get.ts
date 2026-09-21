// GET /api/levels — list the signed-in user's levels (metadata only).
// SQL: 1 session lookup + exactly 1 replica query over the userId index.
// Rows: N metadata rows (never the `data` column). Mutations pin
// bookmarks, so saves/deletes observe immediately.
import { defineHandler } from "nitro";
import { getReplicaDb, listMyLevels, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await listMyLevels(getReplicaDb(event), user.id);
  return { levels: rows };
});
