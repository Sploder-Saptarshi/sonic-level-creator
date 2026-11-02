// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { setResponseHeader } from "nitro/h3";
import { HTTPError } from "nitro";

export default defineHandler((event) => {
  setResponseHeader(event, "Allow", "POST");
  throw new HTTPError({ status: 405, message: "Method Not Allowed" });
});
