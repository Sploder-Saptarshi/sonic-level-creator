// server/utils/session.ts — server-side session lookup for SSR pages.
// Query budget: getSessionUser costs 0 SQL when no session cookie is
// present (fast-path below), else exactly 1 indexed session-token lookup
// via Better Auth. Every page route documents its total budget inline.
import { createAuth } from "../auth/config";
import type { H3Event } from "nitro";

export interface SessionUser {
  id: string;
  username: string;
}

// Multivalued query/body params (Nitro may parse ?a=1&a=2 as arrays):
// take the first value. Shared by page/Auth/level cleaners so the
// `Array.isArray` dance lives in exactly one place.
export function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

// True when the request carries a Better Auth session cookie
// (`better-auth.session_token`, optionally `__Secure-`-prefixed).
// Pure header check — 0 SQL — so guest page hits never touch the DB.
export function hasSessionCookie(event: H3Event): boolean {
  const cookie = event.req.headers.get("cookie");
  if (!cookie) return false;
  return /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
}

export async function getSessionUser(
  event: H3Event,
): Promise<SessionUser | null> {
  // Guests (no cookie) skip Better Auth entirely: 0 SQL. Authenticated
  // hits pay exactly 1 indexed lookup on session.token.
  if (!hasSessionCookie(event)) return null;
  try {
    const auth = createAuth(event);
    const data = await auth.api.getSession({ headers: event.req.headers });
    if (!data?.user) return null;
    const u = data.user as {
      id: string;
      username?: string;
      displayUsername?: string;
      name?: string;
    };
    // Pretty-case display name first (`username` is the lowercased lookup
    // key, so it must never reach the UI).
    return {
      id: u.id,
      username: u.displayUsername ?? u.username ?? u.name ?? "Player",
    };
  } catch {
    return null;
  }
}

// Printable-ASCII usernames (0x20–0x7E: spaces, punctuation, capitals all
// allowed; control/DEL/non-ASCII rejected). Length is enforced separately
// (3–30, matching the better-auth plugin defaults). Single source of truth
// for the signup form (authFlow) and the better-auth username plugin
// (auth/config, which gates sign-up AND sign-in).
export function isAsciiUsername(s: string): boolean {
  return /^[\x20-\x7E]+$/.test(s);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
