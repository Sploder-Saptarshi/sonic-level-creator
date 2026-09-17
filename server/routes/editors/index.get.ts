// GET /editors/ — level creator page (SSR) + editor bundle mount.
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderEditorPage, userLanguageBar } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  const session = await getSessionUser(event);
  return renderEditorPage(
    getQuery(event),
    session
      ? {
        username: session.username,
        languagebar: userLanguageBar(session.username),
      }
      : {},
  );
});
