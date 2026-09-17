// GET /member/signin — member sign-in page (SSR).
import { defineHandler } from "nitro";
import { getQuery, sendRedirect, setResponseHeader } from "nitro/h3";
import { renderSigninPage } from "../../utils/page";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  if (await getSessionUser(event)) return sendRedirect(event, "/editors/");
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderSigninPage(getQuery(event));
});
