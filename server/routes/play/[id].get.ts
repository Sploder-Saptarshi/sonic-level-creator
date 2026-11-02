// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { getRouterParam, sendRedirect } from "nitro/h3";
import { HTTPError } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { renderPlayPage } from "../../utils/page/game";
import { STOCK_LEVEL_ID, findVisibleLevelName } from "../../utils/levels";
import { findReportedLevelName } from "../../utils/reports";
import { getReplicaDb, getRequestDb } from "../../utils/db";
import { isSafeId } from "../../utils/validation";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const id = getRouterParam(event, "id") ?? "";
  if (!isSafeId(id)) {
    throw new HTTPError({ status: 404, message: "Level not found" });
  }
  if (id === STOCK_LEVEL_ID) return sendRedirect(event, "/");
  const session = await getSessionUser(event);
  let row = (await findVisibleLevelName(getReplicaDb(event), id, session))[0];
  if (!row && session) {
    const primary = getRequestDb(event);
    row = (await findVisibleLevelName(primary, id, session))[0];
    if (!row && session.isModerator) {
      row = (await findReportedLevelName(primary, id))[0];
    }
  }
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return html(event, renderPlayPage(row.name, id, toPageView(session, event), row.published));
});
