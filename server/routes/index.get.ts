import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, toPageView } from "../utils/page/chrome";
import { renderGamePage } from "../utils/page/game";
import { getSessionUser } from "../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderGamePage(getQuery(event), toPageView(session, event)));
});
