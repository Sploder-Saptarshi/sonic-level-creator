// POST /editors/reports/delete — moderator-only level delete from the
// reports queue (deleting the level cascades its reports away). Guests
// bounce to sign-in, non-mods 404. SQL: 1 session lookup + exactly 1
// indexed write (owner-or-mod predicate, stock excluded). Always lands
// back on the queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { level } from "../../../db/schema";
import { cleanId, getRequestDb, levelWhereForUser } from "../../../utils/levels";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) {
    await getRequestDb(event)
      .delete(level)
      .where(levelWhereForUser(id, session))
      .returning({ id: level.id });
  }
  return sendRedirect(event, "/editors/reports");
});
