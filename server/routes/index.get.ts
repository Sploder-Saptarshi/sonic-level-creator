// GET / — level player page (SSR flashvars + bootstrap).
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderGamePage } from "../utils/page";

export default defineHandler((event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderGamePage(getQuery(event));
});
