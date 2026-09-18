// GET /member/signup — member sign-up page (SSR).
// SQL: 0 for guests (no cookie fast-path), 1 session lookup + redirect
// for signed-in users. App rows: 0.
import { defineHandler } from "nitro";
import { getQuery, sendRedirect } from "nitro/h3";
import { html, renderSignupPage } from "../../utils/page";
import { alreadySignedIn } from "../../utils/authFlow";

export default defineHandler(async (event) => {
  if (await alreadySignedIn(event)) return sendRedirect(event, "/editors/");
  return html(event, renderSignupPage(getQuery(event)));
});
