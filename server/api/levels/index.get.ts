// GET /api/levels
// The signed-in user's levels (metadata only).
import { defineHandler } from "nitro";
import { getReplicaDb, listMyLevels, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await listMyLevels(getReplicaDb(event), user.id);
  return { levels: rows };
});
