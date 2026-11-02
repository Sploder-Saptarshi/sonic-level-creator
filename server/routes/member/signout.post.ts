// POST /member/signout
// End the session and return to the front page.
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
    // A broken or expired session still lands home.
  }
  await pinFreshBookmark(event);
  return sendRedirect(event, "/");
});
