// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { getQuery, getRequestURL, sendRedirect } from "nitro/h3";
import { html } from "../../utils/page/chrome";
import { renderSignupPage } from "../../utils/page/member";
import { alreadySignedIn, requestNext, resolveNext } from "../../utils/authFlow";
import { getTurnstileSitekey } from "../../utils/turnstile";

export default defineHandler(async (event) => {
  const next = requestNext(event);
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event));
  }
  const origin = getRequestURL(event).origin;
  return html(
    event,
    renderSignupPage(getQuery(event), { next, origin, turnstileSitekey: getTurnstileSitekey(event) }),
  );
});
