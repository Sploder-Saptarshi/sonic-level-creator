// GET / — level player page (SSR flashvars + bootstrap).
// SQL: 0 for guests (no cookie fast-path), 1 session lookup otherwise.
// App rows: 0 (static stock level id, no level query).
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, renderGamePage, toPageView } from "../utils/page";
import { getSessionUser } from "../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderGamePage(getQuery(event), toPageView(session, event)));
});
