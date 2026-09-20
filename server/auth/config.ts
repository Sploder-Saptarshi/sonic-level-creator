// server/auth/config.ts — Better Auth instance factory (both presets).
// One instance per request (Workers bindings only exist per request).
// Sessions are server-side rows in D1/SQLite; passwords are Argon2id.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleNode } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import { hashPassword, verifyPassword } from "./argon2";
import { ensureNodeMigrated, getAuthEnv, getNodeClient } from "./env";
import { isAsciiUsername } from "../utils/session";
import type { H3Event } from "nitro";

export function createAuth(event: H3Event) {
  const env = getAuthEnv(event);
  let db;
  if (env.kind === "d1") {
    db = drizzleD1(env.d1!, { schema });
  } else {
    ensureNodeMigrated();
    db = drizzleNode(getNodeClient(), { schema });
  }

  return betterAuth({
    secret: env.secret,
    // Explicit BETTER_AUTH_URL wins (production + local override). Without
    // it the origin is derived per request from an allowlisted host set —
    // the dynamic form silences Better Auth's "Base URL is not set"
    // warning and keeps varying dev ports working with no env changes.
    baseURL: env.baseURL ?? {
      allowedHosts: ["localhost:*", "127.0.0.1:*", "sonicrelvl.pages.dev"],
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8787",
      "https://sonicrelvl.pages.dev",
    ],
    database: drizzleAdapter(db as any, { provider: "sqlite" }),
    user: {
      // Exposes the DB `role` column on session.user (output only).
      // `input: false` rejects any client-supplied role at sign-up —
      // promotion is a direct DB write, never a form field.
      additionalFields: {
        role: { type: "string", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // Printable-ASCII usernames (spaces, punctuation, capitals allowed).
    // Replaces the plugin default (/^[a-zA-Z0-9_.]+$/), which would reject
    // them at sign-up AND sign-in. Length stays at the plugin defaults
    // (3–30, matching the signup form).
    plugins: [username({ usernameValidator: isAsciiUsername })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
