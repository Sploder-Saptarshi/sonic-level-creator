// GET /ice-shuffle
// Ice Shuffle player (reuses the game page template).
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
      // Crops the 640px movie by 20px on each side.
      headExtra: `<style type="text/css" media="screen">
#gamecontainer { padding-bottom: 1px; width: 605px; margin: 0 auto; overflow: hidden; }
#gamecontainer #gameswf { width: 640px; margin: 0 -20px; }
</style>
`,
      playerSwf: "/games/swf/5/5.swf",
      hideReport: true,
      hideTitle: true,
      hideTouchControls: true,
      sideActive: "ice",
    }),
  );
});
