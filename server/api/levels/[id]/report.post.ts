// POST /api/levels/:id/report — report a level as inappropriate.
// Signed-in users only (401 otherwise); reason is 1–500 chars (400).
// Unknown ids 404. The seeded stock row fakes success without writing
// anything (its report form lives on the index page, but Green Hill is
// known-good — 0 SQL, no auth needed). One open report per user per
// level — re-posts are idempotent (200, duplicate: true).
// SQL: 1 session lookup + 1 level existence read + 1 report read (+1 row
// insert on first report).
import { defineHandler } from "nitro";
import { getRouterParam, readBody } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../../db/schema";
import {
  cleanReportReason,
  createReport,
  getRequestDb,
  requireRow,
  requireUser,
  STOCK_LEVEL_ID,
} from "../../../utils/levels";
import { enforceSameOrigin } from "../../../utils/authFlow";
import { eq } from "drizzle-orm";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const id = getRouterParam(event, "id") ?? "";
  if (!/^[\w-]{1,128}$/.test(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  if (id === STOCK_LEVEL_ID) return { ok: true, duplicate: false };
  const user = await requireUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;
  const reason = cleanReportReason(body?.reason);
  if (!reason) {
    throw new HTTPError({
      status: 400,
      message: "Tell us why this level is inappropriate (1–500 characters).",
    });
  }
  const db = getRequestDb(event);
  const found = await db
    .select({ id: level.id })
    .from(level)
    .where(eq(level.id, id))
    .limit(1);
  requireRow(found);
  const { duplicate } = await createReport(db, id, user.id, reason);
  return { ok: true, duplicate };
});
