// PUT /api/levels/:id — overwrite one of the signed-in user's levels.
// SQL: 1 session lookup + exactly 1 indexed write (PK + owner check;
// RETURNING folds the existence check in — no select round-trip).
// Rows written: <= 1. Success pins a fresh D1 bookmark for replica
// chaining (+1 primary read on the edge). Validation is pure (0 SQL) and
// runs first.
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
  // Single indexed write (PK lookup on id + owner check): RETURNING tells
  // us whether the row existed — no separate select round-trip.
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
