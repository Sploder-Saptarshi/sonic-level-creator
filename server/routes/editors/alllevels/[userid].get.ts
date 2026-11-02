// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler, HTTPError } from "nitro";
import { getRouterParam } from "nitro/h3";
import { html, toPageView } from "../../../utils/page/chrome";
import { listingPagination, renderUserLevelsPage } from "../../../utils/page/lists";
import { LEVELS_PER_PAGE, readListingQuery } from "../../../utils/pagination";
import { findUserById, listPublicLevelsByUserId } from "../../../utils/levels";
import { getReplicaDb } from "../../../utils/db";
import { isSafeId } from "../../../utils/validation";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  const userId = getRouterParam(event, "userid") ?? "";
  if (!isSafeId(userId)) throw new HTTPError({ status: 404, message: "Unknown creator" });
  const db = getReplicaDb(event);
  const [session, [found]] = await Promise.all([getSessionUser(event), findUserById(db, userId)]);
  if (!found) throw new HTTPError({ status: 404, message: "Unknown creator" });
  const view = toPageView(session, event);
  const display = found.displayUsername ?? found.username ?? "Player";
  const total = found.publishedLevelCount ?? 0;
  if (total === 0) return html(event, renderUserLevelsPage({ ...view, levels: [] }, display));

  const query = readListingQuery(event);
  const result = await listPublicLevelsByUserId(db, userId, LEVELS_PER_PAGE, query.keyset);
  const basePath = `/editors/alllevels/${encodeURIComponent(userId)}`;
  const pagination = listingPagination(basePath, query, total, result, (l) => ({ ts: l.updatedAt, id: l.id }));
  const [head] = result.rows;
  const heading = head?.authorDisplay ?? head?.author ?? display;
  return html(event, renderUserLevelsPage({ ...view, levels: result.rows }, heading, pagination));
});
