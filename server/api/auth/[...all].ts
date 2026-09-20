// Pass-through to Better Auth's own endpoints (session upkeep, sign-out,
// client SDK helpers). Credential flows are NOT exposed here: raw
// /sign-up/* and /sign-in/* would bypass the Turnstile bot check, the
// printable-ASCII username policy, and the generic in-page error mapping
// enforced by the /member/* forms. Sign-up/sign-in go through those forms
// only (they call auth.api.* server-side, which never touches this route).
// 404 (not 403) so probes learn nothing about the auth surface.
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
