// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Hand-rolled version of Better Auth's getSession: one query instead of
// two, none without a cookie, and it reads from a replica on the edge.
import { eq } from "drizzle-orm";
import type { H3Event } from "nitro";
import { getCookie } from "nitro/h3";
import { SESSION_EXPIRES_IN_MS, SESSION_UPDATE_AGE_MS } from "../auth/config";
import { getAuthEnv } from "../auth/env";
import { session as sessionTable, user as userTable } from "../db/schema";
import { openReplica, type Db } from "./db";
import { writeBookmark } from "./replica";

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  isModerator: boolean;
}

const keyCache = new Map<string, CryptoKey>();

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const hit = keyCache.get(secret);
  if (hit) return hit;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (keyCache.size < 16) keyCache.set(secret, key);
  return key;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// Better Auth signs cookies as `value.signature` (HMAC-SHA256); some paths
// URL-encode them twice.
async function verifyCookieSignature(signedValue: string, secret: string): Promise<string | null> {
  let decoded = safeDecode(signedValue);
  if (decoded.includes("%")) decoded = safeDecode(decoded);
  const dot = decoded.lastIndexOf(".");
  if (dot < 1) return null;
  const raw = decoded.slice(0, dot);
  const sig = decoded.slice(dot + 1);
  if (sig.length < 43 || sig.length > 44) return null;
  try {
    const key = await getCryptoKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, base64ToBytes(sig), new TextEncoder().encode(raw));
    return ok ? raw : null;
  } catch {
    return null;
  }
}

async function readSessionToken(event: H3Event): Promise<string | null> {
  const raw =
    getCookie(event, "__Secure-better-auth.session_token") ??
    getCookie(event, "better-auth.session_token");
  if (!raw) return null;
  return verifyCookieSignature(raw, getAuthEnv(event).secret);
}

function findSessionRow(db: Db, token: string) {
  return db
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
}

async function refreshSession(db: Db, token: string, expiresAt: Date): Promise<boolean> {
  const now = Date.now();
  const where = eq(sessionTable.token, token);
  if (expiresAt.getTime() < now) {
    await db.delete(sessionTable).where(where);
    return false;
  }
  if (expiresAt.getTime() - SESSION_EXPIRES_IN_MS + SESSION_UPDATE_AGE_MS <= now) {
    await db
      .update(sessionTable)
      .set({ expiresAt: new Date(now + SESSION_EXPIRES_IN_MS), updatedAt: new Date(now) })
      .where(where);
  }
  return true;
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  try {
    const token = await readSessionToken(event);
    if (!token) return null;
    const { db, replica } = openReplica(event);
    const [row] = await findSessionRow(db, token);
    if (!row || !(await refreshSession(db, token, row.expiresAt))) return null;
    if (replica) writeBookmark(event, replica.getBookmark());
    const role = row.role ?? "user";
    return {
      id: row.userId,
      // `username` is the lowercased lookup key
      username: row.displayUsername ?? row.username ?? row.name ?? "Player",
      role,
      isModerator: role === "moderator",
    };
  } catch {
    return null;
  }
}

export function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

export function isAsciiUsername(s: string): boolean {
  return /^[\x20-\x7E]+$/.test(s);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}
