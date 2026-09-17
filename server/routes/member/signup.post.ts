// POST /member/signup — username + password + confirm form.
import { defineHandler } from "nitro";
import { readBody, sendRedirect, setResponseHeader } from "nitro/h3";
import { renderSignupPage } from "../../utils/page";
import { getSessionUser } from "../../utils/session";
import {
  callAuth,
  cleanUsernameInput,
  errorBox,
  forwardCookies,
  syntheticEmail,
} from "../../utils/authFlow";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  if (await getSessionUser(event)) return sendRedirect(event, "/editors/");

  const body = (await readBody(event)) as Record<string, unknown>;
  const username = cleanUsernameInput(body?.username);
  const password = first(body?.password);
  const confirm = first(body?.confirmPassword);
  if (!username) {
    return renderSignupPage({}, {
      formError: errorBox("Pick a username, 3–30 characters."),
    });
  }
  if (typeof password !== "string" || password.length < 8) {
    return renderSignupPage({}, {
      formError: errorBox("Passwords need at least 8 characters."),
    });
  }
  if (password !== confirm) {
    return renderSignupPage({}, {
      formError: errorBox("Passwords do not match."),
    });
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
    return renderSignupPage({}, { formError: errorBox(res.error) });
  }
  forwardCookies(event, res.value.headers);
  return sendRedirect(event, "/editors/");
});
