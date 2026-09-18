// server/auth/env.ts — runtime environment for auth (both presets).
// Workers/Pages: bindings + secrets from the request context.
// Node: process env, SQLite file instead of D1.
import type { H3Event } from "nitro";
import { HTTPError } from "nitro";
import type { D1Database } from "@cloudflare/workers-types";
import { ensureNodeMigrated, getNodeClient, getNodeDb } from "../db/node";

export interface AuthEnv {
  kind: "d1" | "node";
  d1?: D1Database;
  secret: string;
  baseURL?: string;
}

export function getAuthEnv(event: H3Event): AuthEnv {
  // Nitro v3 attaches the Cloudflare context to the request runtime
  // (v2 used event.context.cloudflare.env).
  const cf = ((event.req as any)?.runtime?.cloudflare?.env ??
    (event.context as any)?.cloudflare?.env) as
    | Record<string, any>
    | undefined;
  if (cf?.DB) {
    const secret = cf.BETTER_AUTH_SECRET as string | undefined;
    if (!secret) {
      throw new HTTPError("BETTER_AUTH_SECRET is not set on this Worker");
    }
    return {
      kind: "d1",
      d1: cf.DB as D1Database,
      secret,
      baseURL: cf.BETTER_AUTH_URL as string | undefined,
    };
  }
  // Never fall through to SQLite on the edge — fail loudly instead.
  const isNode =
    typeof process !== "undefined" && !!process.versions?.node;
  if (!isNode) {
    throw new HTTPError("D1 binding DB is missing on this Worker");
  }
  return {
    kind: "node",
    secret:
      process.env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
    // Explicit local override (e.g. https tunnels); otherwise the dynamic
    // allowedHosts form in auth/config.ts derives the origin per request.
    baseURL: process.env.BETTER_AUTH_URL,
  };
}

export { ensureNodeMigrated, getNodeClient, getNodeDb };
