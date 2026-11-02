import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import type { H3Event } from "nitro";
import { hashPassword, verifyPassword } from "./argon2";
import { getAuthEnv } from "./env";
import { getRequestDb } from "../utils/db";
import { isAsciiUsername } from "../utils/session";

export const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 7 * 1000;
export const SESSION_UPDATE_AGE_MS = 60 * 60 * 24 * 1000;

export function createAuth(event: H3Event) {
  const env = getAuthEnv(event);
  return betterAuth({
    secret: env.secret,
    advanced: {
      ipAddress: {
        // set by Cloudflare, can't be spoofed
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    baseURL: env.baseURL ?? {
      allowedHosts: ["localhost:*", "127.0.0.1:*", "sonicrelvl.pages.dev"],
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8787",
      "https://sonicrelvl.pages.dev",
    ],
    database: drizzleAdapter(getRequestDb(event), { provider: "sqlite" }),
    user: {
      // never settable from sign-up; promote via SQL
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
      expiresIn: SESSION_EXPIRES_IN_MS / 1000,
      updateAge: SESSION_UPDATE_AGE_MS / 1000,
    },
    // allow any printable ASCII, not just [a-zA-Z0-9_.]
    plugins: [username({ usernameValidator: isAsciiUsername })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
