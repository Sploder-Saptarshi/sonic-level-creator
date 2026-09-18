// server/utils/compact.ts — compact level storage codec (RLE grid +
// tuple objects as JSON). Single source of truth: imported by the editor
// bundle (via ts/format.ts re-export) and the gateway (server-side).
// Measured 10–27x smaller than comma-decimal CSV: CSV spends ~3.5 chars
// per byte and charges full price for empty cells, while levels are
// mostly zeros. No fallbacks — only this format is read or written.
export interface CompactObject {
  x: number;
  y: number;
  variant: number;
  type: number;
  sub: number;
}

export function encodeCompact(
  grid: number[][],
  objects: CompactObject[],
): string {
  const flat: number[] = [];
  for (const row of grid) for (const id of row) flat.push(id);
  const runs: [number, number][] = [];
  for (const v of flat) {
    const last = runs[runs.length - 1];
    if (last && last[0] === v) last[1]++;
    else runs.push([v, 1]);
  }
  return JSON.stringify({
    w: grid[0].length,
    h: grid.length,
    r: runs,
    o: objects.map((o) => [o.x, o.y, o.variant, o.type, o.sub]),
  });
}

const isInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n);

export function decodeLevel(
  data: string,
): { grid: number[][]; objects: CompactObject[] } | null {
  const t = (data ?? "").trim();
  if (!t || !t.startsWith("{")) return null;
  let doc: any;
  try {
    doc = JSON.parse(t);
  } catch {
    return null;
  }
  if (
    !doc || !isInt(doc.w) || !isInt(doc.h) || doc.w < 1 || doc.w > 256 ||
    doc.h < 1 || doc.h > 256 || !Array.isArray(doc.r) || !Array.isArray(doc.o)
  ) {
    return null;
  }
  const flat: number[] = [];
  for (const run of doc.r) {
    if (
      !Array.isArray(run) || run.length !== 2 || !isInt(run[0]) ||
      !isInt(run[1]) || run[0] < 0 || run[1] < 1
    ) return null;
    for (let i = 0; i < run[1]; i++) flat.push(run[0]);
  }
  if (flat.length !== doc.w * doc.h) return null;
  const grid: number[][] = [];
  for (let r = 0; r < doc.h; r++) {
    grid.push(flat.slice(r * doc.w, (r + 1) * doc.w));
  }
  const objects: CompactObject[] = [];
  for (const e of doc.o) {
    if (!Array.isArray(e) || e.length !== 5 || !e.every(isInt)) return null;
    const [x, y, variant, type, sub] = e;
    if (
      x < 0 || x > 65535 || y < 0 || y > 65535 ||
      variant < 0 || variant > 255 || type < 0 || type > 255 ||
      sub < 0 || sub > 255
    ) return null;
    objects.push({ x, y, variant, type, sub });
  }
  return { grid, objects };
}
