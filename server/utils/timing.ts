// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import type { H3Event } from "nitro";

interface TimingState {
  start: number;
  queries: number;
}

const KEY = "timing";

// replaced at build time by nitro.config.ts (`replace`); "" when unknown
// (bound once: the replacer skips `__COMMIT_SHA__.member` accesses)
declare const __COMMIT_SHA__: string;
const COMMIT_SHA: string = __COMMIT_SHA__;
const REPO_URL = "https://github.com/Sploder-Saptarshi/sonic-level-creator";

function commitLink(): string {
  if (!COMMIT_SHA) return "";
  return `<a href="${REPO_URL}/tree/${COMMIT_SHA}" title="Source Commit" target="_blank" rel="noopener" style="color:inherit;cursor:pointer;">${COMMIT_SHA.slice(0, 7)}</a>`;
}

function stateOf(event: H3Event): TimingState | null {
  const s = (event.context as Record<string, unknown>)[KEY];
  return s && typeof s === "object" ? (s as TimingState) : null;
}

export function startTiming(event: H3Event): TimingState {
  let s = stateOf(event);
  if (!s) {
    s = { start: performance.now(), queries: 0 };
    (event.context as Record<string, unknown>)[KEY] = s;
  }
  return s;
}

export function countQuery(event: H3Event): void {
  startTiming(event).queries += 1;
}

export function dbLogger(event: H3Event): { logQuery(): void } {
  return { logQuery: () => countQuery(event) };
}

function timingLines(event: H3Event | undefined): string[] {
  const s = event ? stateOf(event) : null;
  if (!s) return [];
  const wall = performance.now() - s.start;
  const qLabel = s.queries === 1 ? "1 query" : `${s.queries} queries`;
  return [
    `<span title="Page Execution Time">${wall.toFixed(1)}ms</span>`,
    `<span title="Database Queries">${qLabel}</span>`,
  ];
}

// bottom-right badge: timing stats (when tracked) + source commit link
export function timingBadge(event?: H3Event): string {
  const lines = [...timingLines(event), commitLink()].filter(Boolean);
  if (!lines.length) return "";
  return `<div style="position:fixed;right:0.7vw;bottom:0.7vw;font-size:0.8vw;color:#000;opacity:50%;z-index:1000;text-align:right;cursor:default;user-select:none;">${lines.join("<br>")}</div>`;
}
