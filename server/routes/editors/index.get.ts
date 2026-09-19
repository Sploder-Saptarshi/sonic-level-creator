// GET /editors/ — level creator page (SSR) + editor bundle mount.
// SQL: 0 for guests (fast-path redirect, no session lookup), 1 session
// lookup for members. App rows: 0. Guests resume here after sign-in via
// the attached ?next= target.
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { html, renderEditorPage, toPageView } from "../../utils/page";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  // The editor is members-only: guests go to sign-in, then back here.
  if (!session) return redirectToSignin(event);
  return html(
    event,
    renderEditorPage(getQuery(event), toPageView(session)),
  );
});
