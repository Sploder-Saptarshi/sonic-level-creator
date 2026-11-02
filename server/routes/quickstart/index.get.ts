import { defineHandler } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { renderQuickstartPage } from "../../utils/page/member";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderQuickstartPage(toPageView(session, event)));
});
