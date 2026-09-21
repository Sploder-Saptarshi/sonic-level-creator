// POST /member/signin — username + password form.
// SQL: 0 pre-check for guests (no cookie fast-path), then exactly 1 auth
// call (1 indexed user lookup + 1 session insert on success). Success pins
// a fresh D1 bookmark for replica chaining (+1 primary read on the edge)
// and lands on the validated `next` target, else My Levels. Validation
// failures re-render with 0 writes (keeping the return target). Success
// also queues a user.signed_in webhook as a background task (0 SQL,
// silent no-op in dev / without WEBHOOK_URL).
import { defineHandler } from "nitro";
import { getRequestURL, readBody, sendRedirect } from "nitro/h3";
import { html, renderSigninPage } from "../../utils/page";
import {
  alreadySignedIn,
  callAuth,
  enforceSameOrigin,
  errorBox,
  forwardCookies,
  formString,
  requestNext,
  resolveNext,
} from "../../utils/authFlow";
import { first } from "../../utils/session";
import { pinFreshBookmark } from "../../utils/replica";
import { getTurnstileSitekey, verifyTurnstile } from "../../utils/turnstile";
import { notifyUserSignedIn } from "../../utils/webhook";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  // Body first (pure parse, 0 SQL) so the bounce below can honor a
  // posted `next` target too.
  const body = (await readBody(event)) as Record<string, unknown>;
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event, body));
  }

  const next = requestNext(event, body);
  const origin = getRequestURL(event).origin;
  const turnstileSitekey = getTurnstileSitekey(event);
  const fail = (msg: string) =>
    html(event, renderSigninPage({}, { formError: errorBox(msg), next, origin, turnstileSitekey }));
  const username = formString(body, "signInUsername").trim();
  const password = formString(body, "signInPassword");
  if (!username || !password) {
    return fail("Enter your username and password.");
  }
  // Bot check before the auth call (fresh widget on every re-render, so a
  // consumed single-use token never strands the form).
  const captcha = await verifyTurnstile(
    event,
    first(body?.["cf-turnstile-response"]),
    "signin",
  );
  if (!captcha.ok) {
    return fail(captcha.error);
  }
  const res = await callAuth(event, (auth) =>
    auth.api.signInUsername({
      body: {
        username,
        password,
        rememberMe: formString(body, "remember_me") === "1",
      },
      headers: event.req.headers,
      returnHeaders: true,
    } as any),
  );
  if (!res.ok) {
    return fail(res.error);
  }
  forwardCookies(event, res.value.headers);
  await pinFreshBookmark(event);
  // Background webhook (no-op in dev / when WEBHOOK_URL is unset).
  notifyUserSignedIn(event, username);
  return sendRedirect(event, resolveNext(event, body));
});
