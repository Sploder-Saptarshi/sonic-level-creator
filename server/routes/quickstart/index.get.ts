import { defineHandler } from "nitro";
import { html, renderQuickstartPage, toPageView } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderQuickstartPage(toPageView(session, event)));
});
