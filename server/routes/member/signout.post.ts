// POST /member/signout — clear the session, back to the front page.
// Pins a fresh D1 bookmark afterwards (+1 primary read on the edge) so
// replica session reads observe the deletion immediately.
import { defineHandler } from "nitro";
import { sendRedirect } from "nitro/h3";
import { createAuth } from "../../auth/config";
import { enforceSameOrigin, forwardCookies } from "../../utils/authFlow";
import { pinFreshBookmark } from "../../utils/replica";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  try {
    const res = await createAuth(event).api.signOut({
      headers: event.req.headers,
      returnHeaders: true,
    } as any);
    forwardCookies(event, res.headers);
  } catch {
    // clearing a broken/expired session still lands home
  }
  await pinFreshBookmark(event);
  return sendRedirect(event, "/");
});
