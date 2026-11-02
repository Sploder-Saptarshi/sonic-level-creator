import { defineHandler } from "nitro";
import { readBody } from "nitro/h3";
import { level } from "../../db/schema";
import {
  getRequestDb,
  levelWhere,
  readLevelBody,
  requireRow,
  requireUserAndLevelId,
} from "../../utils/levels";
import { pinFreshBookmark } from "../../utils/replica";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const { name, cols, rows, data } = readLevelBody(body);
  const db = getRequestDb(event);
  const updated = await db
    .update(level)
    .set({ name, cols, rows, data, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id });
  requireRow(updated);
  await pinFreshBookmark(event);
  return { id };
});
