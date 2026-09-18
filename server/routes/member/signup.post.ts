// POST /member/signup — username + password + confirm form.
// SQL: 0 pre-check for guests (no cookie fast-path), then exactly 1 auth
// call (1 user insert + 1 session insert on success). Validation failures
// re-render with 0 writes.
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { html, renderSignupPage } from "../../utils/page";
import {
  alreadySignedIn,
  callAuth,
  cleanUsernameInput,
  errorBox,
  forwardCookies,
  formString,
  syntheticEmail,
} from "../../utils/authFlow";

export default defineHandler(async (event) => {
  if (await alreadySignedIn(event)) return sendRedirect(event, "/editors/");

  const body = (await readBody(event)) as Record<string, unknown>;
  const username = cleanUsernameInput(body?.username);
  const password = formString(body, "password");
  const confirm = formString(body, "confirmPassword");
  if (!username) {
    return html(
      event,
      renderSignupPage({}, {
        formError: errorBox("Pick a username, 3–30 characters."),
      }),
    );
  }
  if (password.length < 8) {
    return html(
      event,
      renderSignupPage({}, {
        formError: errorBox("Passwords need at least 8 characters."),
      }),
    );
  }
  if (password !== confirm) {
    return html(
      event,
      renderSignupPage({}, {
        formError: errorBox("Passwords do not match."),
      }),
    );
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
    return html(event, renderSignupPage({}, { formError: errorBox(res.error) }));
  }
  forwardCookies(event, res.value.headers);
  return sendRedirect(event, "/editors/");
});
