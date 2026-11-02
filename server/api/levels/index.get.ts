// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler } from "nitro";
import { getReplicaDb } from "../../utils/db";
import { listMyLevels } from "../../utils/levels";
import { requireUser } from "../../utils/guards";

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await listMyLevels(getReplicaDb(event), user.id);
  return { levels: rows };
});
