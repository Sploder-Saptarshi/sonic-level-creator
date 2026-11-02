// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// D1 replicas are only reachable through the Sessions API. After a write,
// pinFreshBookmark() stores a bookmark cookie so the next request sees it.
import { getCookie, setCookie } from "nitro/h3";
import type { H3Event } from "nitro";
import type { D1DatabaseSession } from "@cloudflare/workers-types";
import { getAuthEnv } from "../auth/env";
import { countQuery } from "./timing";

const BOOKMARK_COOKIE = "d1-bookmark";

export function getReplicaSession(
  event: H3Event,
  bookmark?: string | null,
): D1DatabaseSession | null {
  const { d1 } = getAuthEnv(event);
  if (!d1) return null;
  try {
    return d1.withSession(bookmark || "first-unconstrained");
  } catch {
    // malformed bookmark cookie
    return null;
  }
}

export function readBookmark(event: H3Event): string | null {
  const v = getCookie(event, BOOKMARK_COOKIE);
  return v && v.length <= 512 ? v : null;
}

export function writeBookmark(
  event: H3Event,
  bookmark: string | null | undefined,
): void {
  if (!bookmark) return;
  setCookie(event, BOOKMARK_COOKIE, bookmark, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
  });
}

export async function pinFreshBookmark(event: H3Event): Promise<void> {
  const session = getReplicaSession(event, "first-primary");
  if (!session) return;
  try {
    await session.prepare("SELECT 1").all();
    countQuery(event);
    writeBookmark(event, session.getBookmark());
  } catch {
  }
}
