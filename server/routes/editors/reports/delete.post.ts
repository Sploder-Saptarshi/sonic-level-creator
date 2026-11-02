// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { defineHandler, HTTPError } from "nitro";
import { readBody, sendRedirect } from "nitro/h3";
import { cleanId } from "../../../utils/validation";
import { deleteLevelAs } from "../../../utils/levels";
import { enforceSameOrigin, redirectToSignin } from "../../../utils/authFlow";
import { getSessionUser } from "../../../utils/session";

export default defineHandler(async (event) => {
  enforceSameOrigin(event);
  const session = await getSessionUser(event);
  if (!session) return redirectToSignin(event, "/editors/reports");
  if (!session.isModerator) throw new HTTPError({ status: 404, message: "Not found" });
  const body = (await readBody(event)) as Record<string, unknown>;
  const id = cleanId(body?.id);
  if (id) await deleteLevelAs(event, session, id);
  return sendRedirect(event, "/editors/reports");
});
