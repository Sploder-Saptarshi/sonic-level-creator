// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import type { H3Event } from "nitro";
import { HTTPError } from "nitro";
import type { D1Database } from "@cloudflare/workers-types";
import { ensureNodeMigrated, getNodeClient, getNodeDb } from "../db/node";

interface AuthEnv {
  kind: "d1" | "node";
  d1?: D1Database;
  secret: string;
  baseURL?: string;
}

export function getCloudflareEnv(event: H3Event): Record<string, unknown> | undefined {
  return event.runtime?.cloudflare?.env;
}

export function getAuthEnv(event: H3Event): AuthEnv {
  const cf = getCloudflareEnv(event);
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
  // Never fall through to SQLite on the edge.
  const isNode =
    typeof process !== "undefined" && !!process.versions?.node;
  if (!isNode) {
    throw new HTTPError("D1 binding DB is missing on this Worker");
  }
  return {
    kind: "node",
    secret:
      process.env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL,
  };
}

export { ensureNodeMigrated, getNodeClient, getNodeDb };
