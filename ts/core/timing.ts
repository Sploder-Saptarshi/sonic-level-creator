// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

const SCRIPT_T0 = performance.now();
console.log(`[editor:timing] bundle executed readyState=${document.readyState}`);

export function timingLog(tag: string) {
  console.log(`[editor:timing] ${tag} +${Math.round(performance.now() - SCRIPT_T0)}ms`);
}

export function resourceMs(name: string): string {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const hit = entries.filter(e => e.name.endsWith(name)).pop();
  return hit ? ` (net ${Math.round(hit.responseEnd - hit.startTime)}ms)` : '';
}
