// POST /api/levels — save a new level for the signed-in user.
import { defineHandler } from "nitro";
import { HTTPError } from "nitro";
import { readBody } from "nitro/h3";
import { level } from "../../db/schema";
import {
  cleanDims,
  cleanLevelData,
  cleanLevelName,
  getRequestDb,
  requireUser,
} from "../../utils/levels";

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
  const id = crypto.randomUUID();
  const db = getRequestDb(event);
  await db
    .insert(level)
    .values({ id, userId: user.id, name, cols, rows, data, createdAt: now, updatedAt: now });
  return { id };
});
