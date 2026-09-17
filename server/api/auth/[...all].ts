// Pass-through to Better Auth's own endpoints (client SDKs, OAuth
// callbacks, session refresh). Our HTML forms use the /member/* POST
// routes below instead, so server-rendered errors stay in-page.
import { defineHandler } from "nitro";
import { createAuth } from "../../auth/config";

export default defineHandler((event) => {
  return createAuth(event).handler(event.req);
});
