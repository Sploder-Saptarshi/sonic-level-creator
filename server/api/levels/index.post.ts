// POST /api/levels
// Save a new level for the signed-in user.
import { defineHandler } from "nitro";
import { readBody } from "nitro/h3";
import { eq, sql } from "drizzle-orm";
import { level, levelSeq } from "../../db/schema";
import { getRequestDb, readLevelBody, requireUser } from "../../utils/levels";
import { pinFreshBookmark } from "../../utils/replica";
import { enforceSameOrigin } from "../../utils/authFlow";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const user = await requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const { name, cols, rows, data } = readLevelBody(body);
  const now = new Date();
  const db = getRequestDb(event);
  // UPDATE ... RETURNING is serialized by SQLite, so concurrent saves
  // never collide.
  const seq = await db
    .update(levelSeq)
    .set({ nextId: sql`${levelSeq.nextId} + 1` })
    .where(eq(levelSeq.id, 1))
    .returning({ nextId: levelSeq.nextId });
  const id = String(seq[0].nextId);
  await db
    .insert(level)
    .values({ id, userId: user.id, name, cols, rows, data, createdAt: now, updatedAt: now });
  await pinFreshBookmark(event);
  return { id };
});
