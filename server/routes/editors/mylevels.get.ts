// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { listingPagination, renderMyLevelsPage } from "../../utils/page/lists";
import { LEVELS_PER_PAGE, readListingQuery } from "../../utils/pagination";
import { getMyLevelTotal, listMyLevelsPage } from "../../utils/levels";
import { getReplicaDb } from "../../utils/db";
import { redirectToSignin } from "../../utils/authFlow";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event);
  const db = getReplicaDb(event);
  const query = readListingQuery(event);
  const [total, result] = await Promise.all([
    getMyLevelTotal(db, session.id),
    listMyLevelsPage(db, session.id, LEVELS_PER_PAGE, query.keyset),
  ]);
  const pagination = listingPagination("/editors/mylevels", query, total, result, (l) => ({ ts: l.updatedAt, id: l.id }));
  return html(event, renderMyLevelsPage({ ...toPageView(session, event), levels: result.rows }, pagination));
});
