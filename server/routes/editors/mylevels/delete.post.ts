// POST /editors/mylevels/delete — ownership-checked delete, 1 indexed
// write (RETURNING folds the existence check in, no select round-trip).
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { level } from "../../../db/schema";
import { getRequestDb, levelWhere } from "../../../utils/levels";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return sendRedirect(event, "/member/signin");
  const body = (await readBody(event)) as Record<string, unknown>;
  const raw = body?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (typeof id === "string" && id.length > 0 && id.length <= 128) {
    await getRequestDb(event)
      .delete(level)
      .where(levelWhere(id, session.id))
      .returning({ id: level.id });
  }
  return sendRedirect(event, "/editors/mylevels");
});
