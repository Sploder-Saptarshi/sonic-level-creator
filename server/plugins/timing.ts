// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { definePlugin } from "nitro";
import type { H3Event } from "nitro";
import { startTiming } from "../utils/timing";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    startTiming(event as unknown as H3Event);
  });
});
