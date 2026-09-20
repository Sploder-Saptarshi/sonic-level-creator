// server/utils/authFlow.ts — shared form-auth plumbing (both presets).
// HTML forms POST here; we call Better Auth server-side so validation
// errors re-render in-page and session cookies are set on our own responses.
import { createAuth } from "../auth/config";
import { escapeHtml, first, getSessionUser, isAsciiUsername } from "./session";
import { appendResponseHeader, getQuery, getRequestURL, sendRedirect } from "nitro/h3";
import type { H3Event } from "nitro";

export function errorBox(msg: string): string {
  if (!msg) return "";
  return `<div class="si-login-form-item-cnt" style="float: none">
<div class="si-login-form-item-left">&nbsp;</div>
<div class="si-login-form-item-right"><div class="si-login-form-errors"><span id="error_text">${escapeHtml(msg)}</span></div></div>
<div class="clear">&nbsp;</div>
</div>`;
}

// Account-page result boxes. The account page doesn't load signin.css, so
// these carry their own acct- styles (see accountHeadExtra in page.ts).
// Colors match the member forms (orange errors) and the editor go-button
// green (success).
function accountBox(msg: string, cls: string): string {
  if (!msg) return "";
  return `<div class="acct-msg ${cls}">${escapeHtml(msg)}</div>`;
}

export function accountErrorBox(msg: string): string {
  return accountBox(msg, "acct-msg-err");
}

export function accountOkBox(msg: string): string {
  return accountBox(msg, "acct-msg-ok");
}

export function forwardCookies(event: H3Event, headers: Headers): void {
  const cookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const c of cookies) appendResponseHeader(event, "set-cookie", c);
}

export function apiMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e &&
    typeof (e as any).message === "string" && (e as any).message) {
    return (e as any).message;
  }
  return "Something went wrong. Please try again.";
}

export function cleanUsernameInput(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length >= 3 && t.length <= 30 && isAsciiUsername(t) ? t : null;
}

// First string value of a form field ("" when missing/non-string).
// Shared by the sign-in/sign-up POST handlers (replaces their local
// `first` clones and per-field typeof guards).
export function formString(body: Record<string, unknown>, key: string): string {
  const s = first(body?.[key]);
  return typeof s === "string" ? s : "";
}

// True when the request already carries a valid session. 0 SQL for
// guests (no cookie fast-path in getSessionUser), 1 indexed lookup
// otherwise. Shared guard for the sign-in/sign-up pages (signed-in
// users bounce to their return target, else the default landing).
export function alreadySignedIn(event: H3Event): Promise<boolean> {
  return getSessionUser(event).then((s) => s !== null);
}

// Default post-login landing: My Levels (was the editor).
export const DEFAULT_LANDING = "/editors/mylevels";

// Validate a `next` return target. Relative paths only — absolute URLs,
// protocol-relative `//host`, backslashes, and whitespace are rejected
// (open-redirect prevention). Null when unusable.
export function cleanNext(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  if (s.length < 1 || s.length > 512) return null;
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (/[\s\\]/.test(s)) return null;
  return s;
}

// Validated `next` from the form body (preferred) or query string, ""
// when absent/invalid. Used to re-render the hidden form field so the
// target survives validation errors.
export function requestNext(
  event: H3Event,
  body?: Record<string, unknown>,
): string {
  return cleanNext(body?.next) ?? cleanNext(getQuery(event).next) ?? "";
}

// Landing after a successful sign-in/sign-up: the validated return
// target, else the default landing. Pure (0 SQL).
export function resolveNext(
  event: H3Event,
  body?: Record<string, unknown>,
): string {
  return requestNext(event, body) || DEFAULT_LANDING;
}

// Guest guard for protected pages: 302 to sign-in with the return target
// attached. Defaults to the current path+query (so /editors/?load=abc
// resumes correctly); pass an explicit target when the current URL isn't
// landable (e.g. the delete POST endpoint -> /editors/mylevels).
export function redirectToSignin(event: H3Event, returnTo?: string) {
  let target = returnTo;
  if (target === undefined) {
    const url = getRequestURL(event);
    target = url.pathname + url.search;
    if (target.length > 512) target = url.pathname;
  }
  return sendRedirect(event, `/member/signin?next=${encodeURIComponent(target)}`);
}

// base64url without padding. Input is always printable ASCII (usernames
// are validated first), so btoa is safe on both Node and Workers.
function base64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Deterministic placeholder email for password auth (real inboxes are
// never used; sign-in is by username). Email-safe names keep the historic
// plain form — every pre-existing account uses it, so it must not change.
// Anything else (spaces, punctuation) is base64url-encoded so the result
// always passes email validation. Theoretical collision (a plain name
// literally shaped like an encoded one, `u-…`) just fails signup dedupe.
export function syntheticEmail(username: string): string {
  const lower = username.toLowerCase();
  if (/^[a-z0-9._-]+$/.test(lower)) return `${lower}@users.sonicrelvl.local`;
  return `u-${base64Url(lower)}@users.sonicrelvl.local`;
}

export async function callAuth<T>(
  event: H3Event,
  fn: (auth: ReturnType<typeof createAuth>) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn(createAuth(event)) };
  } catch (e) {
    return { ok: false, error: apiMessage(e) };
  }
}
