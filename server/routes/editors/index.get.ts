// GET /editors/ — level creator page (SSR) + editor bundle mount.
import { defineHandler } from "nitro";
import { getQuery, setResponseHeader } from "nitro/h3";
import { renderEditorPage } from "../../utils/page";

export default defineHandler((event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return renderEditorPage(getQuery(event));
});
