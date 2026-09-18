// GET /ice-shuffle — Ice Shuffle player. Same game template as the index
// player (no duplicated markup): different SWF, name, and <title>.
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderGamePage, userLanguageBar } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

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
    {
      contentSwf: "/games/swf/5/5.swf",
      playerName: "Ice Shuffle",
      title: "Ice Shuffle | PlaySEGA",
      playerSwf: "/games/swf/5/5.swf",
      hideReport: true,
      hideTitle: true,
      hideEditorButtons: true,
      sideActive: "ice",
    },
  );
});
