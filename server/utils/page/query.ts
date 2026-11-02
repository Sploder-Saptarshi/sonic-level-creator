// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { first, isAsciiUsername } from "../session";
import {
  API_CONNECTOR_ID,
  DEFAULT_LEVEL_ID,
  DEFAULT_TITLE,
  TERRITORIES,
} from "./constants";

export interface PageQuery {
  user?: unknown;
  session?: unknown;
  levelid?: unknown;
  territory?: unknown;
  title?: unknown;
  zoneone?: unknown;
}

export function cleanUsername(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && s.length >= 1 && s.length <= 32 && isAsciiUsername(s)
    ? s
    : "Guest";
}

export function cleanSession(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && /^[\w.-]{1,64}$/.test(s) ? s : API_CONNECTOR_ID;
}

export function cleanLevelId(v: unknown): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : DEFAULT_LEVEL_ID;
}

export function cleanTerritory(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && (TERRITORIES as string[]).includes(s)
    ? s
    : TERRITORIES[0];
}

export function cleanTitle(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 80 ? s : DEFAULT_TITLE;
}

export function cleanZoneOne(v: unknown): number {
  return Number(first(v)) === 0 ? 0 : 1;
}
