// POST /member/signin
// Username + password form.
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
  // Read the body first so the redirect can honor a posted `next`.
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
  if (!username || !password) return fail("Enter your username and password.");
  const captcha = await verifyTurnstile(event, first(body?.["cf-turnstile-response"]), "signin");
  if (!captcha.ok) return fail(captcha.error);
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
  if (!res.ok) return fail(res.error);
  forwardCookies(event, res.value.headers);
  await pinFreshBookmark(event);
  notifyUserSignedIn(event, username);
  return sendRedirect(event, resolveNext(event, body));
});
