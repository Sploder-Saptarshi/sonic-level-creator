import { createAuth } from "../auth/config";
import { escapeHtml, first, getSessionUser, isAsciiUsername } from "./session";
import { appendResponseHeader, getQuery, getRequestURL, sendRedirect } from "nitro/h3";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro";

export function errorBox(msg: string): string {
  if (!msg) return "";
  return `<div class="si-login-form-item-cnt" style="float: none">
<div class="si-login-form-item-left">&nbsp;</div>
<div class="si-login-form-item-right"><div class="si-login-form-errors"><span id="error_text">${escapeHtml(msg)}</span></div></div>
<div class="clear">&nbsp;</div>
</div>`;
}

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
  for (const c of headers.getSetCookie()) appendResponseHeader(event, "set-cookie", c);
}

function apiMessage(e: unknown): string {
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Something went wrong. Please try again.";
}

export function cleanUsernameInput(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length >= 3 && t.length <= 30 && isAsciiUsername(t) ? t : null;
}

export function formString(body: Record<string, unknown>, key: string): string {
  const s = first(body?.[key]);
  return typeof s === "string" ? s : "";
}

export function alreadySignedIn(event: H3Event): Promise<boolean> {
  return getSessionUser(event).then((s) => s !== null);
}

const DEFAULT_LANDING = "/editors/mylevels";

// relative paths only, to prevent open redirects
function cleanNext(v: unknown): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  if (s.length < 1 || s.length > 512) return null;
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (/[\s\\]/.test(s)) return null;
  return s;
}

export function requestNext(
  event: H3Event,
  body?: Record<string, unknown>,
): string {
  return cleanNext(body?.next) ?? cleanNext(getQuery(event).next) ?? "";
}

export function resolveNext(
  event: H3Event,
  body?: Record<string, unknown>,
): string {
  return requestNext(event, body) || DEFAULT_LANDING;
}

// CSRF check. Browsers always send Origin on POST; no Origin means a
// non-browser client (curl, the SWF).
export function enforceSameOrigin(event: H3Event): void {
  const origin = event.req.headers.get("origin");
  if (origin && !isSameHost(origin, getRequestURL(event).host)) {
    throw new HTTPError({ status: 403, message: "Forbidden" });
  }
}

function isSameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function redirectToSignin(event: H3Event, returnTo?: string) {
  let target = returnTo;
  if (target === undefined) {
    const url = getRequestURL(event);
    target = url.pathname + url.search;
    if (target.length > 512) target = url.pathname;
  }
  return sendRedirect(event, `/member/signin?next=${encodeURIComponent(target)}`);
}

function base64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Sign-in is by username; the email is a placeholder. Don't change the
// plain form, existing accounts use it.
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
