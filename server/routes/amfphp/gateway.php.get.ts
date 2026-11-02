import { defineHandler } from "nitro";
import { setResponseHeader } from "nitro/h3";
import { HTTPError } from "nitro";

export default defineHandler((event) => {
  setResponseHeader(event, "Allow", "POST");
  throw new HTTPError({ status: 405, message: "Method Not Allowed" });
});
