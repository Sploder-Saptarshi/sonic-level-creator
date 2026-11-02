// POST /amfphp/gateway.php
// AMF0 game gateway (same contract as the legacy
// PHP endpoint). getLevel serves stored level bytes; other methods return
// the legacy stub replies.
//
// Published rows are served straight from the replica with no session
// lookup. Replica misses and unpublished rows need a session and are
// re-read on the primary (fresh owner previews and moderator reviews).
import { defineHandler, HTTPError } from "nitro";
import type { H3Event } from "nitro";
import { getCookie, readRawBody, setCookie, setResponseHeader } from "nitro/h3";
import { handleAmf } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import {
  findGatewayRow,
  getReplicaDb,
  getRequestDb,
  hasOpenReport,
  isSafeId,
  STOCK_LEVEL_ID,
  type GatewayRow,
} from "../../utils/levels";
import { getSessionUser, type SessionUser } from "../../utils/session";
import { notifyLevelPlayed } from "../../utils/webhook";

// Holds the last played level id: one game boot's repeated getLevel calls
// notify once, while 1 -> 2 -> 1 notifies twice.
const PLAYED_COOKIE = "slc_played";
const PLAYED_COOKIE_TTL = 600;

type Db = ReturnType<typeof getRequestDb>;

class LevelResolver {
  // Published levels served with real bytes (id -> name), for the webhook.
  readonly served = new Map<string, string>();
  private readonly replica: Db;
  private primaryDb: Db | null = null;
  private session: SessionUser | null | undefined;

  constructor(private readonly event: H3Event) {
    this.replica = getReplicaDb(event);
  }

  async user(): Promise<SessionUser | null> {
    if (this.session === undefined) {
      this.session = await getSessionUser(this.event).catch(() => null);
    }
    return this.session;
  }

  async resolve(levelId: string | null): Promise<string> {
    if (!isSafeId(levelId)) return "";
    const replicaRow = (await findGatewayRow(this.replica, levelId))[0];
    if (replicaRow?.published) return this.servePublished(levelId, replicaRow);
    const user = await this.user();
    if (!user) return "";
    const row = (await findGatewayRow(this.primary(), levelId))[0];
    if (!row) return "";
    if (row.published) return this.servePublished(levelId, row);
    return (await this.canPreview(levelId, row, user)) ? levelToCsv(row.data) ?? "" : "";
  }

  private primary(): Db {
    return (this.primaryDb ??= getRequestDb(this.event));
  }

  // Owners preview their own levels; moderators review reported ones.
  private async canPreview(levelId: string, row: GatewayRow, user: SessionUser): Promise<boolean> {
    if (row.userId === user.id) return true;
    if (!user.isModerator) return false;
    return (await hasOpenReport(this.primary(), levelId)).length > 0;
  }

  private servePublished(levelId: string, row: GatewayRow): string {
    const csv = levelToCsv(row.data) ?? "";
    if (csv !== "") this.served.set(levelId, row.name);
    return csv;
  }
}

function bodyBytes(raw: unknown): Uint8Array {
  if (typeof raw === "string") return new TextEncoder().encode(raw);
  return raw instanceof Uint8Array ? raw : new Uint8Array();
}

async function encodeReply(body: Uint8Array, resolver: LevelResolver): Promise<Uint8Array> {
  try {
    return await handleAmf(body, (levelId) => resolver.resolve(levelId));
  } catch (e) {
    if (e instanceof Error && e.message === "amf body too large") {
      throw new HTTPError({ status: 413, message: "Request Entity Too Large" });
    }
    throw new HTTPError({ status: 400, message: "Bad Request" });
  }
}

function readLastPlayed(event: H3Event): string | null {
  try {
    const raw = getCookie(event, PLAYED_COOKIE);
    return isSafeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeLastPlayed(event: H3Event, levelId: string): void {
  try {
    setCookie(event, PLAYED_COOKIE, levelId, {
      path: "/",
      sameSite: "lax",
      maxAge: PLAYED_COOKIE_TTL,
      httpOnly: true,
    });
  } catch {
    // Headers already sent; the level bytes were still served.
  }
}

async function notifyPlays(event: H3Event, resolver: LevelResolver): Promise<void> {
  if (resolver.served.size === 0) return;
  const username = (await resolver.user())?.username ?? null;
  let lastPlayed = readLastPlayed(event);
  for (const [id, name] of resolver.served) {
    if (id === STOCK_LEVEL_ID || id === lastPlayed) continue;
    writeLastPlayed(event, id);
    lastPlayed = id;
    notifyLevelPlayed(event, { id, name }, username);
  }
}

export default defineHandler(async (event) => {
  const resolver = new LevelResolver(event);
  const reply = await encodeReply(bodyBytes(await readRawBody(event, false)), resolver);
  await notifyPlays(event, resolver);
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
