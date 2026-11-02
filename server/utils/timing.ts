// Per-request timing badge (wall-clock + DB query count) shown on every SSR
// page. Queries are counted by the drizzle logger on each db handle.
import type { H3Event } from "nitro";

export interface TimingState {
  start: number;
  queries: number;
}

const KEY = "timing";

function stateOf(event: H3Event): TimingState | null {
  const s = (event.context as Record<string, unknown>)[KEY];
  return s && typeof s === "object" ? (s as TimingState) : null;
}

// First call wins.
export function startTiming(event: H3Event): TimingState {
  let s = stateOf(event);
  if (!s) {
    s = { start: performance.now(), queries: 0 };
    (event.context as Record<string, unknown>)[KEY] = s;
  }
  return s;
}

// For statements that bypass drizzle (pinFreshBookmark).
export function countQuery(event: H3Event): void {
  startTiming(event).queries += 1;
}

// Also counts Better Auth's internal queries, which share the handle.
export function dbLogger(event: H3Event): { logQuery(): void } {
  return { logQuery: () => countQuery(event) };
}

export function timingBadge(event: H3Event): string {
  const s = stateOf(event);
  if (!s) return "";
  const wall = performance.now() - s.start;
  const qLabel = s.queries === 1 ? "1 query" : `${s.queries} queries`;
  return `<div style="position:fixed;right:0.7vw;bottom:0.7vw;font-size:0.8vw;color:#000;opacity:50%;z-index:1000;text-align:right;cursor:default;user-select:none;"><span title="Page Execution Time">${wall.toFixed(1)}ms</span><br><span title="Database Queries">${qLabel}</span></div>`;
}
