// server/utils/webhook.ts — outbound event webhooks (Pages Workers only).
// Fires on level published/deleted/played + user sign-in/sign-up. Delivery
// runs as a background task (waitUntil) so responses never wait for it, and
// failures are swallowed so a dead webhook can never break the app.
//
// Privacy: level details (name/author/url) are only ever attached for
// PUBLISHED levels. Unpublished rows (owner previews, mod-review lookups)
// never trigger a webhook at all — unpublished deletes and unpublished
// plays stay fully silent.
//
// Message texts (exact) + Discord embed colors (site "puck" palette):
//   played     BLACK #222222      "%player% is currently playing %lvlname%!"
//   published  YELLOW #FFCD1A     "%lvlname% has just been uploaded by %player%, Try it out!"
//   deleted    RED #D42300        "%lvlname% was bulldozed by Dr. Eggman, better luck next time!"
//   signed in  LIGHT BLUE #36D0F6 "%player% just logged in, Welcome back!"
//   signed up  BLUE #1A79CD      "%player% just signed up, Welcome to Sonic ReLvl!"
//
// Config: WEBHOOK_URL secret (prod only — set via `wrangler pages secret
// put WEBHOOK_URL`; never in wrangler.toml). Disabled in dev: without the
// edge D1 binding this module is a silent no-op, so `npm run dev` and local
// node builds never send anything. 0 SQL on every path (one background
// HTTPS POST per event when configured).
import type { H3Event } from "nitro";
import { getRequestURL } from "nitro/h3";

export type WebhookEventName =
  | "level.published"
  | "level.deleted"
  | "level.played"
  | "user.signed_in"
  | "user.signed_up";

export interface WebhookLevel {
  id: string;
  // Present only when the level is/was published (see above).
  name?: string;
  author?: string;
  url?: string;
}

export interface WebhookBody {
  event: WebhookEventName;
  site: string;
  at: string;
  // Top-level text (outside the embed): used only for the upload role
  // ping — mentions inside embeds don't trigger notifications.
  content?: string;
  allowed_mentions?: { parse: string[] };
  // Discord embed (description carries the exact message text below).
  embeds: Array<{ description: string; color: number; timestamp: string }>;
  level?: WebhookLevel;
  user?: { username: string };
  // Signed-in actor that triggered the event, when known.
  actor?: string;
}

// Role pinged on every level upload (Discord role mention syntax).
const UPLOAD_PING_ROLE_ID = "1551503269443145768";

// Discord embed colors — site "puck" palette (hex RGB as decimals).
const COLOR_PLAYED = 0x222222; // black puck
const COLOR_PUBLISHED = 0xffcd1a; // yellow puck
const COLOR_DELETED = 0xd42300; // red puck
const COLOR_SIGNED_IN = 0x36d0f6; // light blue puck
const COLOR_SIGNED_UP = 0x1a79cd; // blue puck

function getCloudflareEnv(event: H3Event): Record<string, any> | undefined {
  // Same runtime lookup as auth env (Nitro v3 Cloudflare context).
  return (
    ((event.req as any)?.runtime?.cloudflare?.env ??
      (event.context as any)?.cloudflare?.env) as
      | Record<string, any>
      | undefined
  );
}

// Prod webhook target, or undefined when webhooks are off (dev, or the
// secret isn't set). Requires the edge D1 binding so local dev is always
// a no-op even if WEBHOOK_URL leaks into process env.
export function getWebhookUrl(event: H3Event): string | undefined {
  const cf = getCloudflareEnv(event);
  if (!cf?.DB) return undefined;
  const url = cf.WEBHOOK_URL;
  if (typeof url !== "string" || url.length === 0 || url.length > 2048) {
    return undefined;
  }
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url;
}

function requestOrigin(event: H3Event): string {
  try {
    return getRequestURL(event).origin;
  } catch {
    return "";
  }
}

// Run the delivery off the response path: Cloudflare/Railway-style
// waitUntil when the runtime offers one, else fire-and-forget (never
// awaited, never throwing).
function runInBackground(event: H3Event, task: Promise<unknown>): void {
  const settled = task.catch(() => {});
  try {
    const evt = event as any;
    if (typeof evt.waitUntil === "function") {
      evt.waitUntil(settled);
      return;
    }
    const cfCtx = (event.context as any)?.cloudflare?.context;
    if (cfCtx && typeof cfCtx.waitUntil === "function") {
      cfCtx.waitUntil(settled);
      return;
    }
    const rtCtx = (event.req as any)?.runtime?.cloudflare?.context;
    if (rtCtx && typeof rtCtx.waitUntil === "function") {
      rtCtx.waitUntil(settled);
      return;
    }
  } catch {
    // Background scheduling is best-effort; the fetch below still runs.
  }
}

function send(event: H3Event, body: WebhookBody): void {
  const url = getWebhookUrl(event);
  if (!url) return;
  runInBackground(
    event,
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(body),
    }).then(
      () => {},
      () => {},
    ),
  );
}

function base(
  event: H3Event,
  evt: WebhookEventName,
  description: string,
  color: number,
): WebhookBody {
  const at = new Date().toISOString();
  return {
    event: evt,
    site: requestOrigin(event),
    at,
    embeds: [{ description, color, timestamp: at }],
  };
}

function playUrl(event: H3Event, id: string): string {
  const origin = requestOrigin(event);
  return origin ? `${origin}/play/${id}` : "";
}

// Level just published (always published by construction): full details.
export function notifyLevelPublished(
  event: H3Event,
  level: { id: string; name: string; author: string },
): void {
  const body = base(
    event,
    "level.published",
    `${level.name} has just been uploaded by ${level.author}, Try it out!`,
    COLOR_PUBLISHED,
  );
  body.level = {
    id: level.id,
    name: level.name,
    author: level.author,
    url: playUrl(event, level.id),
  };
  body.actor = level.author;
  // Role ping lives in top-level content (embed mentions don't notify).
  body.content = `<@&${UPLOAD_PING_ROLE_ID}>`;
  body.allowed_mentions = { parse: ["roles"] };
  send(event, body);
}

// Level deleted. Fires only when the deleted row was published (with its
// details); unpublished deletes stay fully silent.
export function notifyLevelDeleted(
  event: H3Event,
  level: {
    id: string;
    name: string | null;
    published: boolean | null;
    author?: string;
    actor?: string;
  },
): void {
  if (level.published !== true || !level.name) return;
  const body = base(
    event,
    "level.deleted",
    `${level.name} was bulldozed by Dr. Eggman, better luck next time!`,
    COLOR_DELETED,
  );
  body.level = {
    id: level.id,
    name: level.name,
    ...(level.author ? { author: level.author } : {}),
    url: playUrl(event, level.id),
  };
  if (level.actor) body.actor = level.actor;
  send(event, body);
}

// Level played (/play/:id hit). Callers must only call this for published
// rows — owner previews and mod-review views of unpublished levels stay
// silent. Guests play as "A guest".
export function notifyLevelPlayed(
  event: H3Event,
  level: { id: string; name: string },
  actor?: string | null,
): void {
  const player = actor || "A guest";
  const body = base(
    event,
    "level.played",
    `${player} is currently playing ${level.name}!`,
    COLOR_PLAYED,
  );
  body.level = { id: level.id, name: level.name, url: playUrl(event, level.id) };
  if (actor) body.actor = actor;
  send(event, body);
}

export function notifyUserSignedIn(event: H3Event, username: string): void {
  const body = base(
    event,
    "user.signed_in",
    `${username} just logged in, Welcome back!`,
    COLOR_SIGNED_IN,
  );
  body.user = { username };
  send(event, body);
}

export function notifyUserSignedUp(event: H3Event, username: string): void {
  const body = base(
    event,
    "user.signed_up",
    `${username} just signed up, Welcome to Sonic ReLvl!`,
    COLOR_SIGNED_UP,
  );
  body.user = { username };
  send(event, body);
}
