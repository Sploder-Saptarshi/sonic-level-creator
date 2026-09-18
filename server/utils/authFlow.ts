// server/utils/authFlow.ts — shared form-auth plumbing (both presets).
// HTML forms POST here; we call Better Auth server-side so validation
// errors re-render in-page and session cookies are set on our own responses.
import { createAuth } from "../auth/config";
import { escapeHtml, first, getSessionUser } from "./session";
import { appendResponseHeader } from "nitro/h3";
import type { H3Event } from "nitro";

export function errorBox(msg: string): string {
  if (!msg) return "";
  return `<div class="si-login-form-item-cnt" style="float: none">
<div class="si-login-form-item-left">&nbsp;</div>
<div class="si-login-form-item-right"><div class="si-login-form-errors"><span id="error_text">${escapeHtml(msg)}</span></div></div>
<div class="clear">&nbsp;</div>
</div>`;
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
  return t.length >= 3 && t.length <= 30 ? t : null;
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
// users bounce to /editors/).
export function alreadySignedIn(event: H3Event): Promise<boolean> {
  return getSessionUser(event).then((s) => s !== null);
}

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@users.sonicrelvl.local`;
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
