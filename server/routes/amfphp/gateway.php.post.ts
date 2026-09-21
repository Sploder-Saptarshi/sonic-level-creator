// POST /amfphp/gateway.php — AMF0 game gateway, database-backed.
// Same URL + contract as the legacy PHP endpoint (the SWF posts here by
// relative path). getLevel resolves the level id to its stored bytes;
// every other method mirrors the legacy stub replies. GET -> 405.
//
// SQL (minimum): 1 indexed replica PK read per getLevel call (1 row, 3
// columns: data/published/userId). The session lookup is lazy — published
// rows serve with 0 session queries; only unpublished rows pay 1 session
// lookup (cached across batched calls). Replica misses with a session get
// one primary retry; unpublished rows always resolve fully on the primary
// (fresh bytes/flags for owner previews, fresh reports for mod review).
// Unknown ids serve '' with 1 replica read (guests/junk never touch the
// primary).
import { defineHandler, HTTPError } from "nitro";
import { readRawBody, setResponseHeader } from "nitro/h3";
import { handleAmf, MAX_AMF_BYTES } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import { findGatewayRow, getReplicaDb, getRequestDb, hasOpenReport } from "../../utils/levels";
import { getSessionUser, type SessionUser } from "../../utils/session";

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
  let reply: Uint8Array;
  try {
    reply = await handleAmf(bytes, async (levelId) => {
      // Level ids are numeric-string (or legacy UUID) keys, same charset
      // the pages enforce. Unbounded strings would each cost a DB lookup
      // on attacker-chosen bytes — reject before any SQL.
      if (!levelId || !/^[\w-]{1,128}$/.test(levelId)) return "";
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
      if (row.published) return levelToCsv(row.data) ?? "";
      if (session === undefined) {
        session = await getSessionUser(event).catch(() => null);
      }
      if (!session) return "";
      if (!onPrimary) {
        // Unpublished on the replica: re-read on the primary for fresh
        // bytes/flags before the owner/mod checks below.
        row = (await findGatewayRow(primary(), levelId))[0];
        if (!row) return "";
        if (row.published) return levelToCsv(row.data) ?? "";
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
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
