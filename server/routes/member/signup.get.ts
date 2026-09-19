// GET /member/signup — member sign-up page (SSR).
// SQL: 0 for guests (no cookie fast-path), 1 session lookup + bounce for
// signed-in users (honoring ?next=, else the default landing). App rows: 0.
import { defineHandler } from "nitro";
import { getQuery, getRequestURL, sendRedirect } from "nitro/h3";
import { html, renderSignupPage } from "../../utils/page";
import { alreadySignedIn, requestNext, resolveNext } from "../../utils/authFlow";

export default defineHandler(async (event) => {
  const next = requestNext(event);
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event));
  }
  const origin = getRequestURL(event).origin;
  return html(event, renderSignupPage(getQuery(event), { next, origin }));
});
