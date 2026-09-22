// POST /api/levels — save a new level for the signed-in user.
// SQL: 1 session lookup + 1 sequencer UPDATE (atomic, 1 row) + 1 row insert.
// Success pins a fresh D1 bookmark for replica chaining (+1 primary read
// on the edge). Validation is pure (0 SQL) and runs before any write.
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
  // Atomic sequencer: single UPDATE ... RETURNING is serialized by SQLite
  // on the primary, so concurrent POSTs never collide (no MAX+1 retry loop).
  // Seeded from MAX(CAST(id AS INT)) in migration 0010; next is MAX+1.
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
