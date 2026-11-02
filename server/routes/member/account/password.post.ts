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
import { pinFreshBookmark } from "../../../utils/replica";
import { getSessionUser } from "../../../utils/session";

function validateInput(body: Record<string, unknown>): string | { currentPassword: string; newPassword: string } {
  const currentPassword = formString(body, "currentPassword");
  const newPassword = formString(body, "newPassword");
  if (!currentPassword || !newPassword) return "Enter your current and a new password.";
  if (newPassword.length < 8) return "Passwords need at least 8 characters.";
  if (newPassword !== formString(body, "confirmPassword")) return "Passwords do not match.";
  return { currentPassword, newPassword };
}

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/member/account");

  const fail = (msg: string) =>
    html(event, renderAccountPage(toPageView(session, event), accountErrorBox(msg)));
  const input = validateInput(body);
  if (typeof input === "string") return fail(input);
  const res = await callAuth(event, (auth) =>
    auth.api.changePassword({
      body: input,
      headers: event.req.headers,
      returnHeaders: true,
    } as any),
  );
  if (!res.ok) return fail(res.error);
  forwardCookies(event, res.value.headers);
  await pinFreshBookmark(event);
  return html(
    event,
    renderAccountPage(toPageView(session, event), accountOkBox("Password changed.")),
  );
});
