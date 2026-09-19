// GET /quickstart — Quick Start Guide (archive body, revival chrome).
// SQL: 0 for guests (no cookie fast-path), 1 session lookup otherwise.
// App rows: 0.
import { defineHandler } from "nitro";
import { html, renderQuickstartPage, toPageView } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(event, renderQuickstartPage(toPageView(session, event)));
});
