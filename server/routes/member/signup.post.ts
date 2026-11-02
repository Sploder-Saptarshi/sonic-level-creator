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

function validateInput(body: Record<string, unknown>): string | { username: string; password: string } {
  const username = cleanUsernameInput(body?.username);
  const password = formString(body, "password");
  if (!username) return "Pick a username, 3–30 printable ASCII characters.";
  if (password.length < 8) return "Passwords need at least 8 characters.";
  if (password !== formString(body, "confirmPassword")) return "Passwords do not match.";
  return { username, password };
}

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event, body));
  }

  const next = requestNext(event, body);
  const origin = getRequestURL(event).origin;
  const turnstileSitekey = getTurnstileSitekey(event);
  const fail = (msg: string) =>
    html(event, renderSignupPage({}, { formError: errorBox(msg), next, origin, turnstileSitekey }));
  const input = validateInput(body);
  if (typeof input === "string") return fail(input);
  const { username, password } = input;
  const captcha = await verifyTurnstile(event, first(body?.["cf-turnstile-response"]), "signup");
  if (!captcha.ok) return fail(captcha.error);
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
  if (!res.ok) return fail(res.error);
  forwardCookies(event, res.value.headers);
  await pinFreshBookmark(event);
  notifyUserSignedUp(event, username);
  return sendRedirect(event, resolveNext(event, body));
});
