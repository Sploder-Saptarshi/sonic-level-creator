import { defineHandler } from "nitro";
import { level } from "../../../db/schema";
import {
  getRequestDb,
  levelWhere,
  requireRow,
  requireUserAndLevelId,
} from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { notifyLevelPublished } from "../../../utils/webhook";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event);
  const db = getRequestDb(event);
  const published = await db
    .update(level)
    .set({ published: true, updatedAt: new Date() })
    .where(levelWhere(id, user.id))
    .returning({ id: level.id, name: level.name });
  const row = requireRow(published);
  await pinFreshBookmark(event);
  notifyLevelPublished(event, { id: row.id, name: row.name, author: user.username });
  return { id };
});
