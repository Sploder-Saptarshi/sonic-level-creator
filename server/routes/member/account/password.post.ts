// POST /member/account/password — change password.
// SQL: 1 session lookup; guests bounce with 0 writes. Validation failures
// re-render with 0 writes. The change itself is one Better Auth call: it
// verifies the current password and hashes the new one with our Argon2id
// hasher (nothing hand-rolled).
import { defineHandler } from "nitro";
import { readBody } from "nitro/h3";
import { html, renderAccountPage, toPageView } from "../../../utils/page";
import {
  accountErrorBox,
  accountOkBox,
  callAuth,
  enforceSameOrigin,
  forwardCookies,
  formString,
  redirectToSignin,
} from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/member/account");

  const fail = (msg: string) =>
    html(event, renderAccountPage(toPageView(session, event), accountErrorBox(msg)));
  const currentPassword = formString(body, "currentPassword");
  const newPassword = formString(body, "newPassword");
  const confirm = formString(body, "confirmPassword");
  if (!currentPassword || !newPassword) {
    return fail("Enter your current and a new password.");
  }
  if (newPassword.length < 8) {
    return fail("Passwords need at least 8 characters.");
  }
  if (newPassword !== confirm) {
    return fail("Passwords do not match.");
  }
  const res = await callAuth(event, (auth) =>
    auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: event.req.headers,
      returnHeaders: true,
    } as any),
  );
  if (!res.ok) {
    return fail(res.error);
  }
  forwardCookies(event, res.value.headers);
  return html(
    event,
    renderAccountPage(toPageView(session, event), accountOkBox("Password changed.")),
  );
});
