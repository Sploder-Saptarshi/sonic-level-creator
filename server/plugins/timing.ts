// Starts the per-request timing clock before any route runs. The badge is
// rendered by timingFor() in server/utils/page/chrome.ts.
import { definePlugin } from "nitro";
import type { H3Event } from "nitro";
import { startTiming } from "../utils/timing";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    // Typed as HTTPEvent; at runtime it is the handlers' H3Event.
    startTiming(event as unknown as H3Event);
  });
});
