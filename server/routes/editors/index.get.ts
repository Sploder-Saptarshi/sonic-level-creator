import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, toPageView } from "../../utils/page/chrome";
import { renderEditorPage } from "../../utils/page/game";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  return html(
    event,
    renderEditorPage(getQuery(event), toPageView(session, event)),
  );
});
