// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler, HTTPError } from "nitro";
import { createAuth } from "../../auth/config";

// Allowlist: every real flow goes through /member/*. Anything else here
// skips our checks (sign-in/up skip Turnstile; update-user let anyone set
// displayUsername to another user's name).
const ALLOWED = new Set(["get-session", "sign-out", "ok"]);

export default defineHandler((event) => {
  const path = new URL(event.req.url, "http://localhost").pathname.replace(
    /^\/api\/auth\/?/,
    "",
  );
  if (!ALLOWED.has(path)) {
    throw new HTTPError({ status: 404, message: "Not found" });
  }
  return createAuth(event).handler(event.req);
});
