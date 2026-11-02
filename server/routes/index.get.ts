// GET /
// Level player for the stock level.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, renderGamePage, toPageView } from "../utils/page";
import { getSessionUser } from "../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderGamePage(getQuery(event), toPageView(session, event)));
});
