// GET /member/account — My Account page (UI shell only for now).
// SQL: 0 for guests (fast-path redirect), else 1 session lookup. Guests
// resume here after sign-in via the attached ?next= target.
import { defineHandler } from "nitro";
import { html, renderAccountPage, toPageView } from "../../utils/page";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  return html(event, renderAccountPage(toPageView(session, event)));
});
