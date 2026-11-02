import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId, cleanLevelName } from "../../../utils/validation";
import { renameLevelAs } from "../../../utils/levels";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) throw new HTTPError({ status: 404, message: "Not found" });
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  const name = cleanLevelName(body?.name);
  if (id && name) await renameLevelAs(event, session, id, name);
  return sendRedirect(event, "/editors/reports");
});
