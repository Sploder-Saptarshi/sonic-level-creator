// GET /member/signup — member sign-up page (SSR).
import { defineHandler } from "nitro";
import { getQuery, sendRedirect, setResponseHeader } from "nitro/h3";
import { renderSignupPage } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  if (await getSessionUser(event)) return sendRedirect(event, "/editors/");
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderSignupPage(getQuery(event));
});
