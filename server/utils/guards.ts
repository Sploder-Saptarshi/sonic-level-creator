// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { HTTPError } from "nitro";
import type { H3Event } from "nitro";
import { getRouterParam } from "nitro/h3";
import { enforceSameOrigin } from "./authFlow";
import { getSessionUser, type SessionUser } from "./session";
import { cleanId } from "./validation";

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event);
  if (!user) throw new HTTPError({ status: 401, message: "Sign in required" });
  return user;
}

export async function requireUserAndLevelId(
  event: H3Event,
  opts: { sameOrigin?: boolean } = {},
): Promise<{ user: SessionUser; id: string }> {
  if (opts.sameOrigin !== false) enforceSameOrigin(event);
  const user = await requireUser(event);
  const id = cleanId(getRouterParam(event, "id"));
  if (!id) throw new HTTPError({ status: 404, message: "Level not found" });
  return { user, id };
}

export function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new HTTPError({ status: 404, message: "Level not found" });
  return row;
}
