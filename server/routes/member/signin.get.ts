// GET /member/signin
// Sign-in page; signed-in users are redirected on.
import { defineHandler } from "nitro";
import { getQuery, getRequestURL, sendRedirect } from "nitro/h3";
import { html, renderSigninPage } from "../../utils/page";
import { alreadySignedIn, requestNext, resolveNext } from "../../utils/authFlow";
import { getTurnstileSitekey } from "../../utils/turnstile";

export default defineHandler(async (event) => {
  const next = requestNext(event);
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event));
  }
  const origin = getRequestURL(event).origin;
  return html(
    event,
    renderSigninPage(getQuery(event), { next, origin, turnstileSitekey: getTurnstileSitekey(event) }),
  );
});
