// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { level } from "../../db/schema";
import { getReplicaDb, getRequestDb } from "../../utils/db";
import { levelWhere } from "../../utils/levels";
import { requireRow, requireUserAndLevelId } from "../../utils/guards";

export default defineHandler(async (event) => {
  const { user, id } = await requireUserAndLevelId(event, { sameOrigin: false });
  let rows = await getReplicaDb(event).select().from(level).where(levelWhere(id, user.id));
  if (!rows[0]) {
    rows = await getRequestDb(event).select().from(level).where(levelWhere(id, user.id));
  }
  return { level: requireRow(rows) };
});
