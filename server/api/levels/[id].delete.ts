// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { deleteLevelWithReports, levelWhere } from "../../utils/levels";
import { getRequestDb } from "../../utils/db";
import { requireRow, requireUserAndLevelId } from "../../utils/guards";
import { pinFreshBookmark } from "../../utils/replica";
import { notifyLevelDeleted } from "../../utils/webhook";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event);
  const deleted = await deleteLevelWithReports(
    getRequestDb(event),
    levelWhere(id, user.id),
  );
  const row = requireRow(deleted);
  await pinFreshBookmark(event);
  notifyLevelDeleted(event, {
    id: row.id,
    name: row.name,
    published: row.published,
    author: user.username,
    actor: user.username,
  });
  return { id };
});
