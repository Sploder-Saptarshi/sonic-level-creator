// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { HTTPError } from "nitro";
import { first } from "./session";

function cleanText(v: unknown, max: number): string | null {
  const s = first(v);
  if (typeof s !== "string") return null;
  const text = s.trim().replace(/\s+/g, " ");
  return text.length >= 1 && text.length <= max ? text : null;
}

export function cleanLevelName(v: unknown): string | null {
  return cleanText(v, 60);
}

export function cleanReportReason(v: unknown): string | null {
  return cleanText(v, 500);
}

function cleanDims(v: unknown): number | null {
  const n = Number(first(v));
  return Number.isInteger(n) && n >= 1 && n <= 256 ? n : null;
}

function cleanLevelData(v: unknown): string | null {
  const s = first(v);
  return typeof s === "string" && s.length <= 1_000_000 ? s : null;
}

export function readLevelBody(body: Record<string, unknown>) {
  const name = cleanLevelName(body?.name);
  const cols = cleanDims(body?.cols);
  const rows = cleanDims(body?.rows);
  const data = cleanLevelData(body?.data ?? "");
  if (!name || !cols || !rows || data === null) {
    throw new HTTPError({
      status: 400,
      message: "Need name (1–60 chars), cols/rows (1–256), data (≤1MB).",
    });
  }
  return { name, cols, rows, data };
}

export function cleanId(v: unknown): string | null {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 128 ? s : null;
}

export function isSafeId(v: unknown): v is string {
  return typeof v === "string" && /^[\w-]{1,128}$/.test(v);
}
