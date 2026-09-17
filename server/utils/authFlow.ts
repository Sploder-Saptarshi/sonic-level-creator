// server/utils/authFlow.ts — shared form-auth plumbing (both presets).
// HTML forms POST here; we call Better Auth server-side so validation
// errors re-render in-page and session cookies are set on our own responses.
import { createAuth } from "../auth/config";
import { escapeHtml } from "./session";
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
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length >= 3 && t.length <= 30 ? t : null;
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
