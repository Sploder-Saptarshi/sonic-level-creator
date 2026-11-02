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
    });
    forwardCookies(event, res.headers);
  } catch {
  }
  await pinFreshBookmark(event);
  return sendRedirect(event, "/");
});
