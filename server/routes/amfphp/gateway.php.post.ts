// POST /amfphp/gateway.php — AMF0 game gateway, database-backed.
// Same URL + contract as the legacy PHP endpoint (the SWF posts here by
// relative path). getLevel resolves the level id to its stored bytes;
// every other method mirrors the legacy stub replies. GET -> 405.
//
// SQL (minimum): 1 indexed PK read per getLevel call (1 row, 3 columns:
// data/published/userId). The session lookup is lazy — published rows
// serve with 0 session queries; only unpublished rows pay 1 session
// lookup (cached across batched calls). Unknown ids serve '' with 1 read.
import { defineHandler } from "nitro";
import { readRawBody, setResponseHeader } from "nitro/h3";
import { handleAmf } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import { findGatewayRow, getRequestDb } from "../../utils/levels";
import { getSessionUser, type SessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const raw = await readRawBody(event, false);
  const bytes =
    typeof raw === "string"
      ? new TextEncoder().encode(raw)
      : raw instanceof Uint8Array
        ? raw
        : new Uint8Array();
  const db = getRequestDb(event);
  // Lazily resolved + cached: most hits are published levels (0 session
  // SQL); unpublished/owned levels resolve it once per request.
  let session: SessionUser | null | undefined;
  const reply = await handleAmf(bytes, async (levelId) => {
    if (!levelId) return "";
    const rows = await findGatewayRow(db, levelId);
    const row = rows[0];
    if (!row) return "";
    if (row.published) return levelToCsv(row.data) ?? "";
    if (session === undefined) {
      session = await getSessionUser(event).catch(() => null);
    }
    if (!session || row.userId !== session.id) return "";
    return levelToCsv(row.data) ?? "";
  });
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
