// POST /api/levels — save a new level for the signed-in user.
import { defineHandler } from "nitro";
import { readBody } from "nitro/h3";
import { HTTPError } from "nitro";
import { sql } from "drizzle-orm";
import { level } from "../../db/schema";
import {
  cleanDims,
  cleanLevelData,
  cleanLevelName,
  getRequestDb,
  requireUser,
} from "../../utils/levels";

function isConflict(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /unique|primary key|constraint/i.test(msg);
}

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const name = cleanLevelName(body?.name);
  const cols = cleanDims(body?.cols);
  const rows = cleanDims(body?.rows);
  const data = cleanLevelData(body?.data ?? "");
  if (!name || !cols || !rows || data === null) {
    throw new HTTPError({
      status: 400,
      message: "Need name (1–60 chars), cols/rows (1–256), data (≤1MB).",
    });
  }
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
