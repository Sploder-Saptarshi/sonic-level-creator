// GET /api/levels — list the signed-in user's levels (metadata only).
import { defineHandler } from "nitro";
import { desc } from "drizzle-orm";
import { level } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getRequestDb, requireUser } from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const db = getRequestDb(event);
  const rows = await db
    .select({
      id: level.id,
      name: level.name,
      cols: level.cols,
      rows: level.rows,
      updatedAt: level.updatedAt,
    })
    .from(level)
    .where(eq(level.userId, user.id))
    .orderBy(desc(level.updatedAt));
  return { levels: rows };
});
