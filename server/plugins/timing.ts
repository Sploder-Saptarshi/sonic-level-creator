import { definePlugin } from "nitro";
import type { H3Event } from "nitro";
import { startTiming } from "../utils/timing";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    startTiming(event as unknown as H3Event);
  });
});
