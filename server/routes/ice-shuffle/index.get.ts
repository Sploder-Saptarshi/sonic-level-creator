// GET /ice-shuffle — Ice Shuffle player. Same game template as the index
// player (no duplicated markup): different SWF, name, and <title>.
// SQL: 0 for guests (no cookie fast-path), 1 session lookup otherwise.
// App rows: 0.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, renderGamePage, toPageView } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  return html(
    event,
    renderGamePage(getQuery(event), toPageView(session, event), {
      contentSwf: "/games/swf/5/5.swf",
      playerName: "Ice Shuffle",
      title: "Ice Shuffle",
      // 1px breathing room at the bottom so the border never sits on game pixels.
      headExtra: `<style type="text/css" media="screen">
#gamecontainer { padding-bottom: 1px; }
</style>
`,
      playerSwf: "/games/swf/5/5.swf",
      hideReport: true,
      hideTitle: true,
      hideEditorButtons: true,
      sideActive: "ice",
    }),
  );
});
