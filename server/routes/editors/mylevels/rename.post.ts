// POST /editors/mylevels/rename — ownership-checked rename (moderators may
// rename any level). SQL: 0 for guests (fast-path redirect), else 1 session
// lookup + exactly 1 indexed write (RETURNING folds the existence check in,
// no select round-trip). Rows written: <= 1. Blank/oversize names fail
// validation (no write); guests land on My Levels after sign-in (the POST
// endpoint itself isn't landable, so no ?next= to it).
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { level } from "../../../db/schema";
import {
  cleanId,
  cleanLevelName,
  getRequestDb,
  levelWhereForUser,
} from "../../../utils/levels";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/mylevels");
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  const name = cleanLevelName(body?.name);
  if (id && name) {
    await getRequestDb(event)
      .update(level)
      .set({ name, updatedAt: new Date() })
      .where(levelWhereForUser(id, session))
      .returning({ id: level.id });
  }
  return sendRedirect(event, "/editors/mylevels");
});
