// POST /member/account/username — change username (requires password).
// SQL: 1 session lookup; guests bounce with 0 writes. Validation failures
// re-render with 0 writes. Authed renames cost exactly 1 account read
// (password check) + 1 availability read (Better Auth, plugin
// normalization) + 1 user-row write. The freak synthetic-email collision
// surfaces as a write-time UNIQUE failure, mapped back to "taken".
import { defineHandler } from "nitro";
import { eq } from "drizzle-orm";
import { readBody } from "nitro/h3";
import { verifyPassword } from "../../../auth/argon2";
import { account as accountTable, user as userTable } from "../../../db/schema";
import { html, renderAccountPage, toPageView } from "../../../utils/page";
import {
  accountErrorBox,
  accountOkBox,
  callAuth,
  cleanUsernameInput,
  formString,
  redirectToSignin,
  syntheticEmail,
} from "../../../utils/authFlow";
import { getRequestDb } from "../../../utils/levels";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/member/account");

  const fail = (msg: string) =>
    html(event, renderAccountPage(toPageView(session, event), accountErrorBox(msg)));
  const username = cleanUsernameInput(body?.username);
  const currentPassword = formString(body, "currentPassword");
  if (!username) {
    return fail("Pick a username, 3–30 printable ASCII characters.");
  }
  if (!currentPassword) {
    return fail("Enter your current password.");
  }
  if (username.toLowerCase() === session.username.toLowerCase()) {
    return fail("That's already your username.");
  }

  // Current password first (same verifier Better Auth signs in with — no
  // hand-rolled crypto). Failing here skips the availability read below.
  const db = getRequestDb(event);
  const accounts = await db
    .select({ password: accountTable.password })
    .from(accountTable)
    .where(eq(accountTable.userId, session.id))
    .limit(1);
  const hash = accounts[0]?.password;
  if (!hash || !(await verifyPassword({ password: currentPassword, hash }))) {
    return fail("Your current password is incorrect.");
  }

  // Availability through the username plugin (exact sign-up normalization).
  const avail = await callAuth(event, (auth) =>
    auth.api.isUsernameAvailable({
      body: { username },
      headers: event.req.headers,
    }),
  );
  if (!avail.ok || !avail.value.available) {
    return fail(avail.ok ? "That username is taken." : avail.error);
  }

  // One write: lookup key (lowercased) + pretty display + synthetic email.
  // Sessions and levels key off userId, so both survive the rename.
  try {
    await db
      .update(userTable)
      .set({
        username: username.toLowerCase(),
        displayUsername: username,
        name: username,
        email: syntheticEmail(username),
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, session.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique constraint/i.test(msg)) {
      return fail("That username is taken.");
    }
    return fail("Something went wrong. Please try again.");
  }

  // Re-read the session so the page (and header) show the new name at once.
  const fresh = await getSessionUser(event);
  return html(
    event,
    renderAccountPage(
      toPageView(fresh ?? session, event),
      accountOkBox(`Username changed to ${username}.`),
    ),
  );
});
