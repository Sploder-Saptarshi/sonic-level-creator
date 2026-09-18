// POST /api/levels — save a new level for the signed-in user.
// SQL: 1 session lookup + 1 aggregate read (MAX id, 1 row) + 1 row insert
// per attempt (succeeds first try absent a PK race; <= 3 attempts).
// Validation is pure (0 SQL) and runs before any write.
import { defineHandler } from "nitro";
import { readBody } from "nitro/h3";
import { HTTPError } from "nitro";
import { sql } from "drizzle-orm";
import { level } from "../../db/schema";
import { getRequestDb, readLevelBody, requireUser } from "../../utils/levels";

function isConflict(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /unique|primary key|constraint/i.test(msg);
}

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const { name, cols, rows, data } = readLevelBody(body);
  const now = new Date();
  const db = getRequestDb(event);
  // Numeric-string ids: the game SWF coerces the levelid flashvar to uint,
  // so UUIDs arrive as getLevel("0"). Original-style numeric ids round-trip.
  // Starts above the seeded stock row (2914); legacy UUID rows are ignored
  // by MAX (CAST AS INTEGER -> 0). PK conflict (racing insert) -> retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = await db
      .select({ max: sql<number | null>`max(cast(${level.id} as integer))` })
      .from(level);
    const id = String(Math.max(base[0]?.max ?? 2914, 2914) + 1);
    try {
      await db
        .insert(level)
        .values({ id, userId: user.id, name, cols, rows, data, createdAt: now, updatedAt: now });
      return { id };
    } catch (e) {
      if (!isConflict(e) || attempt === 2) throw e;
    }
  }
  throw new HTTPError({ status: 503, message: "Could not allocate level id" });
});
