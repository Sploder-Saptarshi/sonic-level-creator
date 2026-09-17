// Canonical /editors -> /editors/ redirect (replaces the old inline JS
// location.replace hack; also fixes the SWF relative-URL base).
// Exact-path match: router-level rules treat the slash as optional.
import { defineHandler } from "nitro";
import { sendRedirect } from "nitro/h3";

export default defineHandler((event) => {
  if (event.path === "/editors") {
    return sendRedirect(event, "/editors/", 301);
  }
});
