// Cloudflare Turnstile verification for sign-in/up. Real keys require
// success, the expected action and an allowlisted hostname; Workers fail
// closed on any missing config. Local Node dev defaults to Cloudflare's
// always-pass test keys.
import type { H3Event } from "nitro";
import { getRequestIP } from "nitro/h3";
import { getCloudflareEnv } from "../auth/env";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's public always-pass test keys (they only accept dummy tokens).
// Other documented test sitekeys: 2x…AB always fails, 3x…FF forces an
// interactive challenge.
export const DEV_TURNSTILE_SITEKEY = "1x00000000000000000000AA";
const DEV_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
const DEV_TURNSTILE_HOSTNAMES = ["localhost", "127.0.0.1"];

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
  const cf = getCloudflareEnv(event);
  const onEdge = cf && (cf.DB || ["TURNSTILE_SECRET", "TURNSTILE_HOSTNAMES", "TURNSTILE_SITEKEY"].some((k) => cf[k] !== undefined));
  if (onEdge) {
    return {
      secret: cf.TURNSTILE_SECRET as string | undefined,
      hostnames: splitHostnames(cf.TURNSTILE_HOSTNAMES),
      sitekey: cf.TURNSTILE_SITEKEY as string | undefined,
    };
  }
  if (typeof process === "undefined" || !process.versions?.node) return { hostnames: [] };
  // Local dev only; Workers never reach this, so production fails closed.
  const hostnames = splitHostnames(process.env.TURNSTILE_HOSTNAMES);
  return {
    secret: process.env.TURNSTILE_SECRET || DEV_TURNSTILE_SECRET,
    hostnames: hostnames.length > 0 ? hostnames : [...DEV_TURNSTILE_HOSTNAMES],
    sitekey: process.env.TURNSTILE_SITEKEY,
  };
}

export function getTurnstileSitekey(event: H3Event): string {
  return getTurnstileEnv(event).sitekey || DEV_TURNSTILE_SITEKEY;
}

interface SiteverifyResult {
  success?: boolean;
  action?: string;
  hostname?: string;
  metadata?: { result_with_testing_key?: boolean };
}

type VerifyResult = { ok: true } | { ok: false; error: string };

const FAILED: VerifyResult = { ok: false, error: "Captcha verification failed. Please try again." };
const NOT_CONFIGURED: VerifyResult = { ok: false, error: "Captcha is not configured. Please try again later." };

async function siteverify(event: H3Event, secret: string, token: string): Promise<SiteverifyResult | null> {
  const params = new URLSearchParams({ secret, response: token });
  const ip = getRequestIP(event, { xForwardedFor: true });
  if (ip) params.set("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: params,
    });
    return res.ok ? ((await res.json()) as SiteverifyResult) : null;
  } catch {
    return null;
  }
}

// Test keys answer with hostname "example.com" and no action, so only real
// keys are held to the action/hostname checks.
function isAccepted(result: SiteverifyResult | null, action: string, hostnames: string[]): boolean {
  if (result?.success !== true) return false;
  if (result.metadata?.result_with_testing_key === true) return true;
  return (
    result.action === action &&
    typeof result.hostname === "string" &&
    hostnames.includes(result.hostname.toLowerCase())
  );
}

export async function verifyTurnstile(
  event: H3Event,
  token: unknown,
  action: "signin" | "signup",
): Promise<VerifyResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return FAILED;
  const { secret, hostnames } = getTurnstileEnv(event);
  if (!secret || hostnames.length === 0) return NOT_CONFIGURED;
  const result = await siteverify(event, secret, token);
  return isAccepted(result, action, hostnames) ? { ok: true } : FAILED;
}
