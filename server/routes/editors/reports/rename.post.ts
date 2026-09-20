// POST /editors/reports/rename — moderator-only level rename from the
// reports queue. Guests bounce to sign-in, non-mods 404. SQL: 1 session
// lookup + exactly 1 indexed write (owner-or-mod predicate, stock
// excluded). Blank/oversize names fail validation (no write). Always
// lands back on the queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { level } from "../../../db/schema";
import {
  cleanId,
  cleanLevelName,
  getRequestDb,
  levelWhereForUser,
} from "../../../utils/levels";
import { redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
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
  return sendRedirect(event, "/editors/reports");
});
