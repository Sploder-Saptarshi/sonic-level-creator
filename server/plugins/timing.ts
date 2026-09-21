// server/plugins/timing.ts — start the per-request timing clock before
// any route runs. The badge itself renders in html() (server/utils/page.ts)
// from this state; query counting rides on the drizzle loggers.
import { definePlugin } from "nitro";
import type { H3Event } from "nitro";
import { startTiming } from "../utils/timing";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    // Nitro 3 types this as HTTPEvent; at runtime it is the same object
    // the route handlers receive as H3Event (shared .context).
    startTiming(event as unknown as H3Event);
  });
});
