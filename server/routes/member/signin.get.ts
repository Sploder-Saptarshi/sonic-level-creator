// GET /member/signin — member sign-in page (SSR).
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderSigninPage } from "../../utils/page";

export default defineHandler((event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderSigninPage(getQuery(event));
});
