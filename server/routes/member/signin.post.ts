// POST /member/signin — username + password form.
// SQL: 0 pre-check for guests (no cookie fast-path), then exactly 1 auth
// call (1 indexed user lookup + 1 session insert on success). Validation
// failures re-render with 0 writes (keeping the return target). Success
// lands on the validated `next` target, else My Levels.
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { html, renderSigninPage } from "../../utils/page";
import {
  alreadySignedIn,
  callAuth,
  errorBox,
  forwardCookies,
  formString,
  requestNext,
  resolveNext,
} from "../../utils/authFlow";

export default defineHandler(async (event) => {
  // Body first (pure parse, 0 SQL) so the bounce below can honor a
  // posted `next` target too.
  const body = (await readBody(event)) as Record<string, unknown>;
  if (await alreadySignedIn(event)) {
    return sendRedirect(event, resolveNext(event, body));
  }

  const next = requestNext(event, body);
  const fail = (msg: string) =>
    html(event, renderSigninPage({}, { formError: errorBox(msg), next }));
  const username = formString(body, "signInUsername").trim();
  const password = formString(body, "signInPassword");
  if (!username || !password) {
    return fail("Enter your username and password.");
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
  return sendRedirect(event, resolveNext(event, body));
});
