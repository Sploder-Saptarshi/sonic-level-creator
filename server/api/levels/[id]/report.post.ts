import { defineHandler } from "nitro";
import { getRouterParam, readBody } from "nitro/h3";
import { HTTPError } from "nitro";
import { level } from "../../../db/schema";
import {
  cleanReportReason,
  createReport,
  getRequestDb,
  isSafeId,
  requireRow,
  requireUser,
  STOCK_LEVEL_ID,
} from "../../../utils/levels";
import { pinFreshBookmark } from "../../../utils/replica";
import { enforceSameOrigin } from "../../../utils/authFlow";
import { eq } from "drizzle-orm";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const id = getRouterParam(event, "id") ?? "";
  if (!isSafeId(id)) {
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
  if (!duplicate) await pinFreshBookmark(event);
  return { ok: true, duplicate };
});
