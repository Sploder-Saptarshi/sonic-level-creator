// Discord webhooks for level published/deleted/played and user sign-in/up.
// Delivery runs in the background and failures are swallowed.
//
// - Only published levels ever produce level events.
// - Played events come from the AMF gateway (not page views, which crawlers
//   would trigger).
// - User-controlled text goes through defuse() so it can't link or mention.
// - Enabled only on the edge with the WEBHOOK_URL secret set
//   (`wrangler pages secret put WEBHOOK_URL`); a no-op in local dev.
import type { H3Event } from "nitro";
import { getRequestURL } from "nitro/h3";
import { getCloudflareEnv } from "../auth/env";

export type WebhookEventName =
  | "level.published"
  | "level.deleted"
  | "level.played"
  | "user.signed_in"
  | "user.signed_up";

export interface WebhookLevel {
  id: string;
  name?: string;
  author?: string;
  url?: string;
}

export interface WebhookBody {
  event: WebhookEventName;
  site: string;
  at: string;
  // Role ping on uploads; mentions inside embeds don't notify.
  content?: string;
  allowed_mentions?: { parse: string[] };
  embeds: Array<{
    title?: string;
    url?: string;
    description: string;
    color: number;
  }>;
  level?: WebhookLevel;
  user?: { username: string };
  actor?: string;
}

const UPLOAD_PING_ROLE_ID = "1551503269443145768";

// Embed colors from the site's "puck" palette.
const COLOR_PLAYED = 0x222222;
const COLOR_PUBLISHED = 0xffcd1a;
const COLOR_DELETED = 0xd42300;
const COLOR_SIGNED_IN = 0x36d0f6;
const COLOR_SIGNED_UP = 0x1a79cd;

// Requires the edge D1 binding, so local dev never sends.
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

const ZWSP = "\u200b";

// Zero-width spaces break Discord's autolink, markdown-link and mention
// parsing while rendering identically.
function defuse(text: string): string {
  return text
    .replace(/(https?):\/\//gi, `$1:${ZWSP}//`)
    .replace(/www\./gi, `www${ZWSP}.`)
    .replace(/([A-Za-z0-9])\.([A-Za-z]{2,})/g, `$1${ZWSP}.$2`)
    .replace(/\]\s*\(/g, `]${ZWSP}(`)
    .replace(/<([@#])/g, `<${ZWSP}$1`)
    .replace(/@(everyone|here)/gi, `@${ZWSP}$1`);
}

function requestOrigin(event: H3Event): string {
  try {
    return getRequestURL(event).origin;
  } catch {
    return "";
  }
}

// Uses the runtime's waitUntil when available, else fire-and-forget.
function runInBackground(event: H3Event, task: Promise<unknown>): void {
  const settled = task.catch(() => {});
  const owners = [
    event as any,
    (event.context as any)?.cloudflare?.context,
    (event.req as any)?.runtime?.cloudflare?.context,
  ];
  const owner = owners.find((o) => typeof o?.waitUntil === "function");
  owner?.waitUntil(settled);
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
    }),
  );
}

function base(
  event: H3Event,
  evt: WebhookEventName,
  description: string,
  color: number,
  title?: { title: string; url?: string },
): WebhookBody {
  return {
    event: evt,
    site: requestOrigin(event),
    at: new Date().toISOString(),
    embeds: [{ ...title, description, color }],
  };
}

function playUrl(event: H3Event, id: string): string {
  const origin = requestOrigin(event);
  return origin ? `${origin}/play/${id}` : "";
}

export function notifyLevelPublished(
  event: H3Event,
  level: { id: string; name: string; author: string },
): void {
  const url = playUrl(event, level.id);
  const name = defuse(level.name);
  const author = defuse(level.author);
  const body = base(
    event,
    "level.published",
    `${name} has just been uploaded by ${author}, try it out!`,
    COLOR_PUBLISHED,
    { title: name, ...(url ? { url } : {}) },
  );
  body.level = {
    id: level.id,
    name: level.name,
    author: level.author,
    url,
  };
  body.actor = level.author;
  body.content = `<@&${UPLOAD_PING_ROLE_ID}>`;
  body.allowed_mentions = { parse: ["roles"] };
  send(event, body);
}

// Silent for unpublished levels.
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
  const name = defuse(level.name);
  const body = base(
    event,
    "level.deleted",
    `${name} was bulldozed by Dr. Eggman, better luck next time!`,
    COLOR_DELETED,
    // No link: the play URL would 404.
    { title: name },
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

// Callers pass published levels only.
export function notifyLevelPlayed(
  event: H3Event,
  level: { id: string; name: string },
  actor?: string | null,
): void {
  const player = defuse(actor || "A guest");
  const name = defuse(level.name);
  const url = playUrl(event, level.id);
  const body = base(
    event,
    "level.played",
    `${player} is currently playing ${name}!`,
    COLOR_PLAYED,
    { title: name, ...(url ? { url } : {}) },
  );
  body.level = { id: level.id, name: level.name, url };
  if (actor) body.actor = actor;
  send(event, body);
}

export function notifyUserSignedIn(event: H3Event, username: string): void {
  const safe = defuse(username);
  const body = base(
    event,
    "user.signed_in",
    `${safe} just logged in, welcome back!`,
    COLOR_SIGNED_IN,
    { title: "Guess who's back?" },
  );
  body.user = { username };
  send(event, body);
}

export function notifyUserSignedUp(event: H3Event, username: string): void {
  const safe = defuse(username);
  const body = base(
    event,
    "user.signed_up",
    `${safe} just signed up, welcome to Sonic ReLvl!`,
    COLOR_SIGNED_UP,
    { title: "A new hero joins the adventure!" },
  );
  body.user = { username };
  send(event, body);
}
