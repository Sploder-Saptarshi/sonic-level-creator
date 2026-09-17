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
    // Production sets BETTER_AUTH_URL explicitly; locally the origin is
    // derived per request (dev ports vary).
    ...(env.baseURL ? { baseURL: env.baseURL } : {}),
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8787",
      "https://sonicrelvl.pages.dev",
    ],
    database: drizzleAdapter(db as any, { provider: "sqlite" }),
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
    plugins: [username()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
