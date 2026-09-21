// server/utils/replica.ts — D1 read-replica routing (Workers only).
// Replicas serve reads ONLY through the Sessions API (`withSession`);
// plain binding queries always hit the primary (WEUR). Every helper here
// degrades to the primary off the edge (local SQLite, or a binding that
// predates the Sessions API), so callers need no environment branches.
//
// Freshness contract: unconstrained sessions may lag the primary by
// seconds. Public listings tolerate that; login/logout pin a fresh
// bookmark (pinFreshBookmark) chained via the `d1-bookmark` cookie so the
// next request's session reads observe the just-committed write. Writes
// issued through a session are forwarded to the primary by D1 itself.
import { getCookie, setCookie } from "nitro/h3";
import type { H3Event } from "nitro";
import type { D1Database, D1DatabaseSession } from "@cloudflare/workers-types";
import { getAuthEnv } from "../auth/env";
import { countQuery } from "./timing";

const BOOKMARK_COOKIE = "d1-bookmark";

// Request-scoped D1 session for replica reads, or null when sessions are
// unavailable. `bookmark` chains a previous session's freshness (the
// login/logout cookie); without it the session is unconstrained (first
// query goes to any replica or the primary, later queries stay
// sequentially consistent within the request).
export function getReplicaSession(
  event: H3Event,
  bookmark?: string | null,
): D1DatabaseSession | null {
  const env = getAuthEnv(event);
  const d1 = env.d1 as D1Database | undefined;
  if (env.kind !== "d1" || !d1 || typeof d1.withSession !== "function") {
    return null;
  }
  try {
    return d1.withSession(bookmark || "first-unconstrained");
  } catch {
    return null;
  }
}

// Chained bookmark from the request cookie (null when absent/invalid).
// An opaque version marker, not a secret — HttpOnly anyway since client
// JS never needs it.
export function readBookmark(event: H3Event): string | null {
  try {
    const v = getCookie(event, BOOKMARK_COOKIE);
    return typeof v === "string" && v.length >= 1 && v.length <= 512 ? v : null;
  } catch {
    return null;
  }
}

// Persist a session bookmark for the next request in this browser.
// SameSite=Lax (top-level navigations carry it), Path=/, 7d to match the
// server-side session lifetime. No `secure` flag so http localhost keeps
// working (no replicas locally — the cookie just rides along).
export function writeBookmark(
  event: H3Event,
  bookmark: string | null | undefined,
): void {
  if (!bookmark) return;
  try {
    setCookie(event, BOOKMARK_COOKIE, bookmark, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
    });
  } catch {
    // Headers already sent: chaining is best-effort, the app stays
    // correct on the primary.
  }
}

// Pin a post-write bookmark (login/logout): one cheap primary read whose
// bookmark is guaranteed >= the just-committed write, chained to the next
// request so replica session reads observe it. 1 query, 0 rows; a no-op
// off the edge (no session available).
export async function pinFreshBookmark(event: H3Event): Promise<void> {
  const session = getReplicaSession(event, "first-primary");
  if (!session) return;
  try {
    await session.prepare("SELECT 1").all();
    countQuery(event);
    writeBookmark(event, session.getBookmark());
  } catch {
    // Chaining is best-effort; the app stays correct on the primary.
  }
}
