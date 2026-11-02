import { defineHandler, HTTPError } from "nitro";
import { createAuth } from "../../auth/config";

export default defineHandler((event) => {
  const path = new URL(event.req.url, "http://localhost").pathname.replace(
    /^\/api\/auth\/?/,
    "",
  );
  if (/^sign-(up|in)(\/|$)/.test(path)) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
  return createAuth(event).handler(event.req);
});
