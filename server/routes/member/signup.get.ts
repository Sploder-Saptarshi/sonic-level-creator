// GET /member/signup — member sign-up page (SSR, same chrome as signin).
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderSignupPage } from "../../utils/page";

export default defineHandler((event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderSignupPage(getQuery(event));
});
