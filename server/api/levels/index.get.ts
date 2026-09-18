// GET /api/levels — list the signed-in user's levels (metadata only).
// SQL: 1 session lookup + exactly 1 app query over the userId index.
// Rows: N metadata rows (never the `data` column).
import { defineHandler } from "nitro";
import { getRequestDb, listMyLevels, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await listMyLevels(getRequestDb(event), user.id);
  return { levels: rows };
});
