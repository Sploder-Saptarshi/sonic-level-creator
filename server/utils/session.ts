// server/utils/session.ts — server-side session lookup for SSR pages.
// Query budget: getSessionUser costs 0 SQL when no session cookie is
// present (fast-path below), else exactly 1 indexed session-token lookup
// with the user row joined in. Better Auth's own getSession costs 2
// (session row, then user row) and now serves only the auth flows
// (sign-in/up/out, account) — the per-request hot path below replicates
// its semantics by hand: cookie precedence, expiry (+ dropping the dead
// row, as its GET path does), and the updateAge sliding window. On the
// edge the lookup runs inside a D1 read-replica session (bookmark-chained
// per browser, refreshed below), so authed page hits usually avoid the
// primary; every page route documents its total budget inline.
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { H3Event } from "nitro";
import { getCookie } from "nitro/h3";
import type { D1Database } from "@cloudflare/workers-types";
import { SESSION_EXPIRES_IN_MS, SESSION_UPDATE_AGE_MS } from "../auth/config";
import { getAuthEnv, getNodeDb } from "../auth/env";
import { session as sessionTable, user as userTable } from "../db/schema";
import { getReplicaSession, readBookmark, writeBookmark } from "./replica";
import { dbLogger } from "./timing";

const subtle = (): SubtleCrypto | null => {
  try {
    const c: unknown = (globalThis as Record<string, unknown>).crypto;
    if (c && typeof (c as Crypto).subtle === "object") return (c as Crypto).subtle;
    const w: unknown = (globalThis as Record<string, unknown>).WebCrypto;
    if (w && typeof w === "object") return w as unknown as SubtleCrypto;
  } catch {}
  return null;
};

const keyCache = new Map<string, CryptoKey>();

async function getCryptoKey(secret: string): Promise<CryptoKey | null> {
  const hit = keyCache.get(secret);
  if (hit) return hit;
  const s = subtle();
  if (!s) return null;
  try {
    const k = await s.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    // Cache per-secret (rotation-safe): Pages may run 2 Workers with old+new
    // BETTER_AUTH_SECRET during rolling deploys; singleton would stick to old.
    // Import is ~µs, so Map is optional but avoids re-import on hot path.
    // Bound the map to avoid unbounded growth on junk secrets (only real
    // secrets hit the verify path; attacker-controlled values miss before here).
    if (keyCache.size < 16) keyCache.set(secret, k);
    return k;
  } catch {
    return null;
  }
}

async function verifyCookieSignature(
  signedValue: string,
  secret: string,
): Promise<string | null> {
  // Better Call's signed cookies are `value.signature` (HMAC-SHA256,
  // base64, 44 chars, ends with `=`), URL-encoded on the wire. Direct
  // decode before splitting — getCookie already does one decode, the
  // extra is harmless (idempotent on unencoded input).
  let decoded: string;
  try {
    decoded = decodeURIComponent(signedValue);
  } catch {
    decoded = signedValue;
  }
  // Some paths double-encode — peel once more if a `%` survived.
  if (decoded.includes("%")) {
    try {
      const again = decodeURIComponent(decoded);
      if (again !== decoded) decoded = again;
    } catch {}
  }
  const dot = decoded.lastIndexOf(".");
  if (dot < 1) return null;
  const raw = decoded.slice(0, dot);
  let sigB64 = decoded.slice(dot + 1);
  // HMAC-SHA256 is 32B → 44 chars base64 (padded) or 43 base64urlnopad.
  // Accept both so a future better-call switch (base64urlnopad) doesn't
  // silently turn every session into guest. Mirrors upstream but permissive.
  if (sigB64.length < 43 || sigB64.length > 44) return null;
  // Normalize base64url → base64 and pad for atob
  sigB64 = sigB64.replace(/-/g, "+").replace(/_/g, "/");
  while (sigB64.length % 4 !== 0) sigB64 += "=";
  const k = await getCryptoKey(secret);
  const s = subtle();
  if (!k || !s) return null;
  try {
    const bin = atob(sigB64);
    const sig = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sig[i] = bin.charCodeAt(i);
    const ok = await s.verify("HMAC", k, sig, new TextEncoder().encode(raw));
    return ok ? raw : null;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  isModerator: boolean;
}

// Multivalued query/body params (Nitro may parse ?a=1&a=2 as arrays):
// take the first value. Shared by page/Auth/level cleaners so the
// `Array.isArray` dance lives in exactly one place.
export function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

export async function getSessionUser(
  event: H3Event,
): Promise<SessionUser | null> {
  // Raw signed cookies (better-call HMAC-SHA256, `token.signature`). Try
  // the secure variant first, as the framework does. Unknown cookies
  // (no dot, bad signature length, bad HMAC) miss without any SQL.
  const raw =
    getCookie(event, "__Secure-better-auth.session_token") ??
    getCookie(event, "better-auth.session_token");
  if (!raw) return null;
  let token: string | null = null;
  try {
    const env0 = getAuthEnv(event);
    token = await verifyCookieSignature(raw, env0.secret);
  } catch {
    return null;
  }
  if (!token) return null;
  try {
    const env = getAuthEnv(event);
    const replica =
      env.kind === "d1" ? getReplicaSession(event, readBookmark(event)) : null;
    const db =
      env.kind === "d1"
        ? (drizzleD1((replica ?? env.d1!) as unknown as D1Database, {
            schema: { session: sessionTable, user: userTable },
            logger: dbLogger(event),
          }) as unknown as ReturnType<typeof getNodeDb>)
        : getNodeDb(event);
    // Token is unique; the user rides the PK join. Minimal columns — the
    // hot path never needed the full session/user rows.
    const rows = await db
      .select({
        expiresAt: sessionTable.expiresAt,
        userId: userTable.id,
        name: userTable.name,
        username: userTable.username,
        displayUsername: userTable.displayUsername,
        role: userTable.role,
      })
      .from(sessionTable)
      .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
      .where(eq(sessionTable.token, token))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const now = Date.now();
    if (row.expiresAt.getTime() < now) {
      // Expired: drop the dead row, then miss. The stale browser cookie
      // dies on its own max-age; the next hit misses on the lookup above.
      await db.delete(sessionTable).where(eq(sessionTable.token, token));
      return null;
    }
    if (
      row.expiresAt.getTime() - SESSION_EXPIRES_IN_MS + SESSION_UPDATE_AGE_MS <=
      now
    ) {
      // Sliding window (session.updateAge): push expiry a full lifetime
      // out. Through a replica session the write lands on the primary;
      // the bookmark below chains the freshness for what follows.
      await db
        .update(sessionTable)
        .set({
          expiresAt: new Date(now + SESSION_EXPIRES_IN_MS),
          updatedAt: new Date(now),
        })
        .where(eq(sessionTable.token, token));
    }
    if (replica) writeBookmark(event, replica.getBookmark());
    const role = row.role ?? "user";
    return {
      id: row.userId,
      // Pretty-case display name first (`username` is the lowercased lookup
      // key, so it must never reach the UI).
      username: row.displayUsername ?? row.username ?? row.name ?? "Player",
      role,
      isModerator: role === "moderator",
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
