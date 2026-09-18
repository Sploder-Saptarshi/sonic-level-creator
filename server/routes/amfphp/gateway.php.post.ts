// POST /amfphp/gateway.php — AMF0 game gateway, database-backed.
// Same URL + contract as the legacy PHP endpoint (the SWF posts here by
// relative path). getLevel resolves the level id to its stored bytes;
// every other method mirrors the legacy stub replies. GET -> 405.
import { defineHandler } from "nitro";
import { readRawBody, setResponseHeader } from "nitro/h3";
import { level } from "../../db/schema";
import { eq } from "drizzle-orm";
import { handleAmf } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import { getRequestDb } from "../../utils/levels";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const raw = await readRawBody(event, false);
  const bytes =
    typeof raw === "string"
      ? new TextEncoder().encode(raw)
      : raw instanceof Uint8Array
        ? raw
        : new Uint8Array();
  // 1 indexed PK read per getLevel call. Published rows serve everyone;
  // owners can also play their own unpublished rows (the game sends the
  // session cookie same-origin). Anything else serves ''.
  const db = getRequestDb(event);
  const session = await getSessionUser(event).catch(() => null);
  const reply = await handleAmf(bytes, async (levelId) => {
    if (!levelId) return "";
    const rows = await db
      .select({ data: level.data, published: level.published, userId: level.userId })
      .from(level)
      .where(eq(level.id, levelId));
    const row = rows[0];
    if (!row) return "";
    if (!row.published && (!session || row.userId !== session.id)) return "";
    return levelToCsv(row.data) ?? "";
  });
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
