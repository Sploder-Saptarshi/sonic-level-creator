// POST /member/signup — username + password + confirm form.
// SQL: 0 pre-check for guests (no cookie fast-path), then exactly 1 auth
// call (1 user insert + 1 session insert on success). Success pins a fresh
// D1 bookmark for replica chaining (+1 primary read on the edge) and lands
// on the validated `next` target, else My Levels. Validation failures
// re-render with 0 writes (keeping the return target). Success also
// queues a user.signed_up webhook as a background task (0 SQL, silent
// no-op in dev / without WEBHOOK_URL).
import { defineHandler } from "nitro";
import { getRequestURL, readBody, sendRedirect } from "nitro/h3";
import { html, renderSignupPage } from "../../utils/page";
import {
  alreadySignedIn,
  callAuth,
  cleanUsernameInput,
  enforceSameOrigin,
  errorBox,
  forwardCookies,
  formString,
  requestNext,
  resolveNext,
  syntheticEmail,
} from "../../utils/authFlow";
import { first } from "../../utils/session";
import { pinFreshBookmark } from "../../utils/replica";
import { getTurnstileSitekey, verifyTurnstile } from "../../utils/turnstile";
import { notifyUserSignedUp } from "../../utils/webhook";

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
    html(event, renderSignupPage({}, { formError: errorBox(msg), next, origin, turnstileSitekey }));
  const username = cleanUsernameInput(body?.username);
  const password = formString(body, "password");
  const confirm = formString(body, "confirmPassword");
  if (!username) {
    return fail("Pick a username, 3–30 printable ASCII characters.");
  }
  if (password.length < 8) {
    return fail("Passwords need at least 8 characters.");
  }
  if (password !== confirm) {
    return fail("Passwords do not match.");
  }
  // Bot check before creating the account (fresh widget on every
  // re-render, so a consumed single-use token never strands the form).
  const captcha = await verifyTurnstile(
    event,
    first(body?.["cf-turnstile-response"]),
    "signup",
  );
  if (!captcha.ok) {
    return fail(captcha.error);
  }
  const res = await callAuth(event, (auth) =>
    auth.api.signUpEmail({
      body: {
        email: syntheticEmail(username),
        password,
        name: username,
        username,
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
  notifyUserSignedUp(event, username);
  return sendRedirect(event, resolveNext(event, body));
});
