// PUT /api/levels/:id — overwrite one of the signed-in user's levels.
import { defineHandler } from "nitro";
import { getRouterParam, readBody } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../db/schema";
import {
  cleanDims,
  cleanLevelData,
  cleanLevelName,
  getRequestDb,
  levelWhere,
  requireUser,
} from "../../utils/levels";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, "id") ?? "";
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
  // Single indexed write (PK lookup on id + owner check): RETURNING tells
  // us whether the row existed — no separate select round-trip.
  const db = getRequestDb(event);
  const updated = await db
    .update(level)
    .set({ name, cols, rows, data, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  if (!updated[0]) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  return { id };
});
