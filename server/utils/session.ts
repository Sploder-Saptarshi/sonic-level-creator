// server/utils/session.ts — server-side session lookup for SSR pages.
import { createAuth } from "../auth/config";
import type { H3Event } from "nitro";

export interface SessionUser {
  id: string;
  username: string;
}

export async function getSessionUser(
  event: H3Event,
): Promise<SessionUser | null> {
  try {
    const auth = createAuth(event);
    const data = await auth.api.getSession({ headers: event.req.headers });
    if (!data?.user) return null;
    const u = data.user as { id: string; username?: string; name?: string };
    return { id: u.id, username: u.username ?? u.name ?? "Player" };
  } catch {
    return null;
  }
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
