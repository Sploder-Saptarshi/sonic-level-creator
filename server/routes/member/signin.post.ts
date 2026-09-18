// POST /member/signin — username + password form.
// SQL: 0 pre-check for guests (no cookie fast-path), then exactly 1 auth
// call (1 indexed user lookup + 1 session insert on success). Validation
// failures re-render with 0 writes.
import { defineHandler } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { html, renderSigninPage } from "../../utils/page";
import {
  alreadySignedIn,
  callAuth,
  errorBox,
  forwardCookies,
  formString,
} from "../../utils/authFlow";

export default defineHandler(async (event) => {
  if (await alreadySignedIn(event)) return sendRedirect(event, "/editors/");

  const body = (await readBody(event)) as Record<string, unknown>;
  const username = formString(body, "signInUsername").trim();
  const password = formString(body, "signInPassword");
  if (!username || !password) {
    return html(
      event,
      renderSigninPage({}, {
        formError: errorBox("Enter your username and password."),
      }),
    );
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
    return html(event, renderSigninPage({}, { formError: errorBox(res.error) }));
  }
  forwardCookies(event, res.value.headers);
  return sendRedirect(event, "/editors/");
});
