// server/utils/timing.ts — per-request server-timing badge, rendered
// bottom-right of every SSR page: wall-clock, CPU time, DB query count,
// heap. Started once per request by server/plugins/timing.ts; queries are
// counted through the drizzle logger on every db handle (plus one manual
// bump for pinFreshBookmark's raw SELECT 1).
//
// Workers expose no CPU/RSS counters, so those render n/a on the edge and
// real numbers on node — never faked. Badge content is pure numbers
// (nothing user-controlled reaches it).
import type { H3Event } from "nitro";

export interface TimingState {
  start: number;
  // Statements executed this request (drizzle loggers + manual bumps).
  queries: number;
}

const KEY = "timing";

function stateOf(event: H3Event): TimingState | null {
  const s = (event.context as Record<string, unknown>)[KEY];
  return s && typeof s === "object" ? (s as TimingState) : null;
}

// Start the clock. First call wins; safe to call from anywhere.
export function startTiming(event: H3Event): TimingState {
  let s = stateOf(event);
  if (!s) {
    s = { start: performance.now(), queries: 0 };
    (event.context as Record<string, unknown>)[KEY] = s;
  }
  return s;
}

// Manual +1 for statements that bypass drizzle (pinFreshBookmark).
export function countQuery(event: H3Event): void {
  const s = stateOf(event) ?? startTiming(event);
  s.queries += 1;
}

// Drizzle logger for every per-request db handle: counts each executed
// statement, including Better Auth's internal ones (they share the handle).
export function dbLogger(event: H3Event): { logQuery(): void } {
  return {
    logQuery() {
      const s = stateOf(event) ?? startTiming(event);
      s.queries += 1;
    },
  };
}

// Renders the badge for the layout's <%~ it.srvTiming %> slot (currently
// wall-clock only). Empty when timing never started (non-request contexts).
export function timingBadge(event: H3Event): string {
  const s = stateOf(event);
  if (!s) return "";
  const wall = performance.now() - s.start;
  return `<div style="position:fixed;right:0.7vw;bottom:0.7vw;font-size:0.8vw;color:#000;opacity:50%;z-index:1000;text-align:right;cursor:default;user-select:none;"><span title="Page Execution Time">${wall.toFixed(1)}ms</span><br><span title="Database Queries">${s.queries} queries</span></div>`;
}
