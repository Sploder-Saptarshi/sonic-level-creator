import { defineHandler } from "nitro";
import { html, toPageView } from "../../utils/page/chrome";
import { listingPagination, renderAllLevelsPage } from "../../utils/page/lists";
import { LEVELS_PER_PAGE, readListingQuery } from "../../utils/pagination";
import { getPublishedLevelTotal, listPublicLevels } from "../../utils/levels";
import { getReplicaDb } from "../../utils/db";
import { getSessionUser } from "../../utils/session";

export default defineHandler(async (event) => {
  const db = getReplicaDb(event);
  const query = readListingQuery(event);
  const [session, total, result] = await Promise.all([
    getSessionUser(event),
    getPublishedLevelTotal(db),
    listPublicLevels(db, LEVELS_PER_PAGE, query.keyset),
  ]);
  const pagination = listingPagination("/editors/alllevels", query, total, result, (l) => ({ ts: l.updatedAt, id: l.id }));
  return html(event, renderAllLevelsPage({ ...toPageView(session, event), levels: result.rows }, pagination));
});
