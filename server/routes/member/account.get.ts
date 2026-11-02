// GET /member/account
// My Account (change username / password).
import { defineHandler } from "nitro";
import { html, renderAccountPage, toPageView } from "../../utils/page";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  return html(event, renderAccountPage(toPageView(session, event)));
});
