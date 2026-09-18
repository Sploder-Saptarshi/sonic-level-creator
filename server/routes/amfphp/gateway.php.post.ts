// POST /amfphp/gateway.php — AMF0 game gateway, database-backed.
// Same URL + contract as the legacy PHP endpoint (the SWF posts here by
// relative path). getLevel resolves the level id to its stored bytes;
// every other method mirrors the legacy stub replies. GET -> 405.
import { defineHandler } from "nitro";
import { readRawBody, setResponseHeader } from "nitro/h3";
import { level } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { handleAmf } from "../../utils/amf";
import { levelToCsv } from "../../utils/levelBytes";
import { getRequestDb } from "../../utils/levels";

export default defineHandler(async (event) => {
  const raw = await readRawBody(event, false);
  const bytes =
    typeof raw === "string"
      ? new TextEncoder().encode(raw)
      : raw instanceof Uint8Array
        ? raw
        : new Uint8Array();
  // 1 indexed PK read per getLevel call. Published rows only — private
  // levels never leave the database (unknown/unpublished ids serve '',
  // same as the legacy missing-file path).
  const db = getRequestDb(event);
  const reply = await handleAmf(bytes, async (levelId) => {
    if (!levelId) return "";
    const rows = await db
      .select({ data: level.data })
      .from(level)
      .where(and(eq(level.id, levelId), eq(level.published, true)));
    const csv = rows[0] ? levelToCsv(rows[0].data) : null;
    return csv ?? "";
  });
  setResponseHeader(event, "content-type", "application/x-amf");
  return Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
});
