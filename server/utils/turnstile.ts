// server/utils/turnstile.ts — Cloudflare Turnstile verification for the
// member forms (sign-in + sign-up). Browser -> our backend -> siteverify;
// the secret never leaves the server. Real keys require success === true,
// the expected per-form action, and a hostname from the deployment
// allowlist. Fails closed on Workers: missing secret, missing allowlist,
// network trouble, or a bad token all reject. Local `npm run dev` (Node)
// defaults to Cloudflare's always-pass test credentials so the forms work
// with zero config — never use test keys in production. 0 SQL either way
// (one HTTPS round-trip on the happy path).
import type { H3Event } from "nitro";
import { getRequestIP } from "nitro/h3";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Local-dev defaults: Cloudflare's documented always-pass test credentials
// (public docs — safe to embed; test secrets ONLY accept dummy tokens, so
// they are useless to an attacker with a real widget). Deployed envs
// override via TURNSTILE_SITEKEY / TURNSTILE_SECRET / TURNSTILE_HOSTNAMES.
// The real dev key (0x4AAAAAAE9zjsPE26cAcz7h) lives in wrangler.toml [vars]
// + .dev.vars.example for testing the real challenge flow locally.
export const DEV_TURNSTILE_SITEKEY = "1x00000000000000000000AA";
const DEV_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
const DEV_TURNSTILE_HOSTNAMES = ["localhost", "127.0.0.1"];

// Other documented dummy keys for manual testing (must pair sitekey +
// secret — real secrets reject dummy tokens):
//   sitekey 2x00000000000000000000AB + secret 2x0000…0AA  always fails
//     (visible, exercises the error-handling path)
//   sitekey 1x00000000000000000000AA + secret 3x0000…0AA  token-already-spent
//   sitekey 3x00000000000000000000FF  forces an interactive challenge

interface TurnstileEnv {
  secret?: string;
  hostnames: string[];
  sitekey?: string;
}

function splitHostnames(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function getTurnstileEnv(event: H3Event): TurnstileEnv {
  // Same runtime lookup as auth env (Nitro v3 Cloudflare context).
  const cf = ((event.req as any)?.runtime?.cloudflare?.env ??
    (event.context as any)?.cloudflare?.env) as
    | Record<string, any>
    | undefined;
  if (cf?.DB || cf?.TURNSTILE_SECRET !== undefined || cf?.TURNSTILE_HOSTNAMES !== undefined || cf?.TURNSTILE_SITEKEY !== undefined) {
    return {
      secret: cf?.TURNSTILE_SECRET as string | undefined,
      hostnames: splitHostnames(cf?.TURNSTILE_HOSTNAMES),
      sitekey: cf?.TURNSTILE_SITEKEY as string | undefined,
    };
  }
  if (typeof process !== "undefined" && !!process.versions?.node) {
    // Local dev: fall back to the always-pass test credentials (plus
    // loopback hostnames) so sign-in/up work with zero config. Explicit
    // env wins — set the real keys to test the real challenge flow.
    // Workers never reach this branch, so production stays fail-closed.
    const hostnames = splitHostnames(process.env.TURNSTILE_HOSTNAMES);
    return {
      secret: process.env.TURNSTILE_SECRET || DEV_TURNSTILE_SECRET,
      hostnames: hostnames.length > 0 ? hostnames : [...DEV_TURNSTILE_HOSTNAMES],
      sitekey: process.env.TURNSTILE_SITEKEY,
    };
  }
  return { hostnames: [] };
}

// Public site key for the widget, per request on Workers (env binding)
// or process env locally. Falls back to the dev key.
export function getTurnstileSitekey(event: H3Event): string {
  return getTurnstileEnv(event).sitekey || DEV_TURNSTILE_SITEKEY;
}

export async function verifyTurnstile(
  event: H3Event,
  token: unknown,
  action: "signin" | "signup",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, error: "Captcha verification failed. Please try again." };
  }
  const { secret, hostnames } = getTurnstileEnv(event);
  if (!secret || hostnames.length === 0) {
    return {
      ok: false,
      error: "Captcha is not configured. Please try again later.",
    };
  }
  const params = new URLSearchParams({ secret, response: token });
  const ip = getRequestIP(event, { xForwardedFor: true });
  if (ip) params.set("remoteip", ip);
  let result: {
    success?: boolean;
    action?: string;
    hostname?: string;
    metadata?: { result_with_testing_key?: boolean };
  };
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: params,
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = (await res.json()) as typeof result;
  } catch {
    return { ok: false, error: "Captcha verification failed. Please try again." };
  }
  if (result.success !== true) {
    return { ok: false, error: "Captcha verification failed. Please try again." };
  }
  // Dummy test keys (metadata.result_with_testing_key) answer success with
  // hostname "example.com" and no action — action/hostname checks only
  // apply to real keys. Test secrets must never reach production.
  if (result.metadata?.result_with_testing_key === true) {
    return { ok: true };
  }
  if (
    result.action !== action ||
    typeof result.hostname !== "string" ||
    !hostnames.includes(result.hostname.toLowerCase())
  ) {
    return { ok: false, error: "Captcha verification failed. Please try again." };
  }
  return { ok: true };
}
