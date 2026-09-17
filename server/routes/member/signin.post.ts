// POST /member/signin — username + password form.
import { defineHandler } from "nitro";
import { readBody, sendRedirect, setResponseHeader } from "nitro/h3";
import { renderSigninPage } from "../../utils/page";
import { getSessionUser } from "../../utils/session";
import { callAuth, errorBox, forwardCookies } from "../../utils/authFlow";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export default defineHandler(async (event) => {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  if (await getSessionUser(event)) return sendRedirect(event, "/editors/");

  const body = (await readBody(event)) as Record<string, unknown>;
  const usernameRaw = first(body?.signInUsername);
  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
  const password = first(body?.signInPassword);
  if (!username || typeof password !== "string" || !password) {
    return renderSigninPage({}, {
      formError: errorBox("Enter your username and password."),
    });
  }
  const res = await callAuth(event, (auth) =>
    auth.api.signInUsername({
      body: {
        username,
        password,
        rememberMe: first(body?.remember_me) === "1",
      },
      headers: event.req.headers,
      returnHeaders: true,
    } as any),
  );
  if (!res.ok) {
    return renderSigninPage({}, { formError: errorBox(res.error) });
  }
  forwardCookies(event, res.value.headers);
  return sendRedirect(event, "/editors/");
});
