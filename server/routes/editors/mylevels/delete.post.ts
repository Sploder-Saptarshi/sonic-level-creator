// POST /editors/mylevels/delete
// Owner-or-moderator level delete.
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId, deleteLevelAs } from "../../../utils/levels";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/mylevels");
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) await deleteLevelAs(event, session, id);
  return sendRedirect(event, "/editors/mylevels");
});
