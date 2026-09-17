// GET / — level player page (SSR flashvars + bootstrap).
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderGamePage, userLanguageBar } from "../utils/page";
import { getSessionUser } from "../utils/session";

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  const session = await getSessionUser(event);
  return renderGamePage(
    getQuery(event),
    session
      ? {
        username: session.username,
        languagebar: userLanguageBar(session.username),
      }
      : {},
  );
});
