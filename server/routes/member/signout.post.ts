// POST /member/signout — clear the session, back to the front page.
import { defineHandler } from "nitro";
import { sendRedirect } from "nitro/h3";
import { createAuth } from "../../auth/config";
import { enforceSameOrigin, forwardCookies } from "../../utils/authFlow";

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
  return sendRedirect(event, "/");
});
