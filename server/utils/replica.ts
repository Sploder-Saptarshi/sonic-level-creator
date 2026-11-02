// D1 read-replica routing. Replicas only serve reads through the Sessions
// API; plain binding queries hit the primary. Off the edge every helper
// degrades to the primary.
//
// Unconstrained sessions may lag by seconds. Every mutating handler calls
// pinFreshBookmark so the next request (via the `d1-bookmark` cookie)
// observes its write.
import { getCookie, setCookie } from "nitro/h3";
import type { H3Event } from "nitro";
import type { D1Database, D1DatabaseSession } from "@cloudflare/workers-types";
import { getAuthEnv } from "../auth/env";
import { countQuery } from "./timing";

const BOOKMARK_COOKIE = "d1-bookmark";

// Null when sessions are unavailable. Without a bookmark the session is
// unconstrained but stays sequentially consistent within the request.
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

export function readBookmark(event: H3Event): string | null {
  try {
    const v = getCookie(event, BOOKMARK_COOKIE);
    return typeof v === "string" && v.length >= 1 && v.length <= 512 ? v : null;
  } catch {
    return null;
  }
}

// Not `secure`, so http://localhost keeps working.
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
    // Headers already sent; chaining is best-effort.
  }
}

// One cheap primary read whose bookmark covers the just-committed write.
export async function pinFreshBookmark(event: H3Event): Promise<void> {
  const session = getReplicaSession(event, "first-primary");
  if (!session) return;
  try {
    await session.prepare("SELECT 1").all();
    countQuery(event);
    writeBookmark(event, session.getBookmark());
  } catch {
    // Chaining is best-effort.
  }
}
