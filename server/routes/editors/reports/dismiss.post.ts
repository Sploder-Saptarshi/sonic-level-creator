// POST /editors/reports/dismiss — dismiss every open report on one level.
// Moderators only (guests bounce to sign-in, non-mods 404). SQL: 1 session
// lookup + exactly 1 indexed write. The write pins a fresh D1 bookmark for
// replica chaining (+1 primary read on the edge), so the redirect back to
// the queue observes it. Always lands back on the queue.
import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import {
  cleanId,
  dismissReportsForLevel,
  getRequestDb,
} from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
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
  const levelId = cleanId(body?.levelId);
  if (levelId) {
    await dismissReportsForLevel(getRequestDb(event), levelId);
    await pinFreshBookmark(event);
  }
  return sendRedirect(event, "/editors/reports");
});
