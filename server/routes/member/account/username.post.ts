import { defineHandler } from "nitro";
import type { H3Event } from "nitro";
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
  enforceSameOrigin,
  formString,
  redirectToSignin,
  syntheticEmail,
} from "../../../utils/authFlow";
import { getRequestDb } from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { getSessionUser, type SessionUser } from "../../../utils/session";

type Db = ReturnType<typeof getRequestDb>;

function validateInput(body: Record<string, unknown>, session: SessionUser): string | { username: string; password: string } {
  const username = cleanUsernameInput(body?.username);
  const password = formString(body, "currentPassword");
  if (!username) return "Pick a username, 3–30 printable ASCII characters.";
  if (!password) return "Enter your current password.";
  if (username === session.username) return "That's already your username.";
  return { username, password };
}

async function passwordMatches(db: Db, userId: string, password: string): Promise<boolean> {
  const [row] = await db
    .select({ password: accountTable.password })
    .from(accountTable)
    .where(eq(accountTable.userId, userId))
    .limit(1);
  return !!row?.password && (await verifyPassword({ password, hash: row.password }));
}

async function availabilityError(event: H3Event, session: SessionUser, username: string): Promise<string | null> {
  if (username.toLowerCase() === session.username.toLowerCase()) return null;
  const avail = await callAuth(event, (auth) =>
    auth.api.isUsernameAvailable({ body: { username }, headers: event.req.headers }),
  );
  if (!avail.ok) return avail.error;
  return avail.value.available ? null : "That username is taken.";
}

async function writeUsername(db: Db, userId: string, username: string): Promise<string | null> {
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
      .where(eq(userTable.id, userId));
    return null;
  } catch (e) {
    const unique = e instanceof Error && /unique constraint/i.test(e.message);
    return unique ? "That username is taken." : "Something went wrong. Please try again.";
  }
}

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/member/account");
  const fail = (msg: string) =>
    html(event, renderAccountPage(toPageView(session, event), accountErrorBox(msg)));

  const input = validateInput(body, session);
  if (typeof input === "string") return fail(input);
  const db = getRequestDb(event);
  if (!(await passwordMatches(db, session.id, input.password))) {
    return fail("Your current password is incorrect.");
  }
  const error =
    (await availabilityError(event, session, input.username)) ??
    (await writeUsername(db, session.id, input.username));
  if (error) return fail(error);

  await pinFreshBookmark(event);
  const fresh = await getSessionUser(event);
  return html(
    event,
    renderAccountPage(toPageView(fresh ?? session, event), accountOkBox(`Username changed to ${input.username}.`)),
  );
});
