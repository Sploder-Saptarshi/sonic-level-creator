import { defineHandler } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { renderAccountPage } from "../../utils/page/member";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  return html(event, renderAccountPage(toPageView(session, event)));
});
