// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId } from "../../../utils/validation";
import { dismissReportsForLevel } from "../../../utils/reports";
import { getRequestDb } from "../../../utils/db";
import { pinFreshBookmark } from "../../../utils/replica";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) throw new HTTPError({ status: 404, message: "Not found" });
  const body = (await readBody(event)) as Record<string, unknown>;
  const levelId = cleanId(body?.levelId);
  if (levelId) {
    await dismissReportsForLevel(getRequestDb(event), levelId);
    await pinFreshBookmark(event);
  }
  return sendRedirect(event, "/editors/reports");
});
