// POST /amfphp/gateway.php — AMF0 game gateway, database-backed.
// Same URL + contract as the legacy PHP endpoint (the SWF posts here by
// relative path). getLevel resolves the level id to its stored bytes;
// every other method mirrors the legacy stub replies. GET -> 405.
//
// SQL (minimum): 1 indexed replica PK read per getLevel call (1 row, 4
// columns: data/name/published/userId). The session lookup is lazy — published
// rows serve with 0 session queries; only unpublished rows pay 1 session
// lookup (cached across batched calls). Replica misses with a session get
// one primary retry; unpublished rows always resolve fully on the primary
// (fresh bytes/flags for owner previews, fresh reports for mod review).
// Unknown ids serve '' with 1 replica read (guests/junk never touch the
// primary). Serving published bytes also records the level for the
// level.played webhook below (deduped by a last-played cookie, so one
// game boot's repeated getLevel calls notify once but 1 -> 2 -> 1
// notifies twice; 0 extra SQL, silent no-op in dev / without WEBHOOK_URL).
import { defineHandler, HTTPError } from "nitro";
import { getCookie, readRawBody, setCookie, setResponseHeader } from "nitro/h3";
import { handleAmf, MAX_AMF_BYTES } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import { findGatewayRow, getReplicaDb, getRequestDb, hasOpenReport, isSafeId, STOCK_LEVEL_ID } from "../../utils/levels";
import { getSessionUser, type SessionUser } from "../../utils/session";
import { notifyLevelPlayed } from "../../utils/webhook";

// Played-cookie window: one game boot (and its immediate retries) fires
// exactly one webhook. A single cookie holds the last played level id —
// replaying the same level stays silent, but playing a different level
// moves the marker, so going 1 -> 2 -> 1 notifies twice (once per visit).
// Replays after expiry count as new plays.
const PLAYED_COOKIE = "slc_played";
const PLAYED_COOKIE_TTL = 600;

export default defineHandler(async (event) => {
  const raw = await readRawBody(event, false);
  const bytes =
    typeof raw === "string"
      ? new TextEncoder().encode(raw)
      : raw instanceof Uint8Array
        ? raw
        : new Uint8Array();
  const db = getReplicaDb(event);
  // Primary handle, built lazily: only replica misses and unpublished rows
  // ever need it (see below).
  let primaryDb: ReturnType<typeof getRequestDb> | null = null;
  const primary = () => {
    if (!primaryDb) primaryDb = getRequestDb(event);
    return primaryDb;
  };
  // Lazily resolved + cached: most hits are published levels (0 session
  // SQL); unpublished/owned levels resolve it once per request.
  let session: SessionUser | null | undefined;
  // Published levels actually served in this request (id -> name), deduped
  // here so batched duplicate getLevel messages notify once. Only rows
  // served with real bytes land here — unpublished previews, empty rows,
  // and misses never do.
  const served = new Map<string, string>();
  const servePublished = (id: string, name: string, data: string): string => {
    const csv = levelToCsv(data) ?? "";
    if (csv !== "") served.set(id, name);
    return csv;
  };
  let reply: Uint8Array;
  try {
    reply = await handleAmf(bytes, async (levelId) => {
      // Level ids are numeric-string (or legacy UUID) keys, same charset
      // the pages enforce. Unbounded strings would each cost a DB lookup
      // on attacker-chosen bytes — reject before any SQL.
      if (!isSafeId(levelId)) return "";
      let row = (await findGatewayRow(db, levelId))[0];
      let onPrimary = false;
      if (!row) {
        // Replica miss: guests and junk stop here. Authed clients get one
        // primary retry (own rows written seconds ago, mod review).
        if (session === undefined) {
          session = await getSessionUser(event).catch(() => null);
        }
        if (!session) return "";
        row = (await findGatewayRow(primary(), levelId))[0];
        if (!row) return "";
        onPrimary = true;
      }
      if (row.published) return servePublished(levelId, row.name, row.data);
      if (session === undefined) {
        session = await getSessionUser(event).catch(() => null);
      }
      if (!session) return "";
      if (!onPrimary) {
        // Unpublished on the replica: re-read on the primary for fresh
        // bytes/flags before the owner/mod checks below.
        row = (await findGatewayRow(primary(), levelId))[0];
        if (!row) return "";
        if (row.published) return servePublished(levelId, row.name, row.data);
      }
      if (row.userId === session.id) return levelToCsv(row.data) ?? "";
      // Moderators can load unpublished levels with an active report
      // (review flow). Report probe on the primary so just-filed reports
      // are visible; one indexed probe, only on this rare path.
      if (!session.isModerator) return "";
      const open = await hasOpenReport(primary(), levelId);
      if (!open[0]) return "";
      return levelToCsv(row.data) ?? "";
    });
  } catch (e) {
    if (e instanceof Error && e.message === "amf body too large") {
      throw new HTTPError({ status: 413, message: "Request Entity Too Large" });
    }
    throw new HTTPError({ status: 400, message: "Bad Request" });
  }
  // Played webhooks for the published levels served above: stock excluded
  // (same as the listings). The last-played cookie dedupes one game boot's
  // repeated getLevel calls, but a different level moves the marker — so
  // 1 -> 2 -> 1 notifies for level 1 twice. Guests pay 0 extra SQL
  // (getSessionUser fast-paths without a cookie); signed-in players pay 1
  // session lookup, resolved once here.
  if (served.size > 0) {
    if (session === undefined) {
      session = await getSessionUser(event).catch(() => null);
    }
    let lastPlayed: string | null = null;
    try {
      const raw = getCookie(event, PLAYED_COOKIE);
      lastPlayed = isSafeId(raw) ? raw : null;
    } catch {
      lastPlayed = null;
    }
    for (const [id, name] of served) {
      if (id === STOCK_LEVEL_ID) continue;
      // Same level as the last notified play: the boot/retry double —
      // stay silent without moving the marker.
      if (lastPlayed === id) continue;
      try {
        setCookie(event, PLAYED_COOKIE, id, {
          path: "/",
          sameSite: "lax",
          maxAge: PLAYED_COOKIE_TTL,
          httpOnly: true,
        });
      } catch {
        // Headers already sent: best-effort, the bytes above still served.
      }
      lastPlayed = id;
      notifyLevelPlayed(event, { id, name }, session?.username ?? null);
    }
  }
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
