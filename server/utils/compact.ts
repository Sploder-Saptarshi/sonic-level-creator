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

const inRange = (n: number, max: number) => n >= 0 && n <= max;

interface CompactDoc {
  w: number;
  h: number;
  r: unknown[];
  o: unknown[];
}

function parseDoc(data: string): CompactDoc | null {
  const t = (data ?? "").trim();
  if (!t.startsWith("{")) return null;
  let doc: any;
  try {
    doc = JSON.parse(t);
  } catch {
    return null;
  }
  const validSize = isInt(doc?.w) && isInt(doc.h) && doc.w >= 1 && doc.w <= 256 && doc.h >= 1 && doc.h <= 256;
  return validSize && Array.isArray(doc.r) && Array.isArray(doc.o) ? doc : null;
}

// check runs before expanding them, so a hostile level can't blow up memory
function expandRuns(runs: unknown[], total: number): number[] | null {
  if (runs.length > total + 1) return null;
  const flat: number[] = [];
  for (const run of runs) {
    if (!Array.isArray(run) || run.length !== 2) return null;
    const [value, count] = run;
    if (!isInt(value) || !isInt(count) || !inRange(value, 0xffffffff) || count < 1) return null;
    if (count > total - flat.length) return null;
    for (let i = 0; i < count; i++) flat.push(value);
  }
  return flat.length === total ? flat : null;
}

function parseObjects(entries: unknown[]): CompactObject[] | null {
  const objects: CompactObject[] = [];
  for (const e of entries) {
    if (!Array.isArray(e) || e.length !== 5 || !e.every(isInt)) return null;
    const [x, y, variant, type, sub] = e as number[];
    const valid = inRange(x, 65535) && inRange(y, 65535) && inRange(variant, 255) && inRange(type, 255) && inRange(sub, 255);
    if (!valid) return null;
    objects.push({ x, y, variant, type, sub });
  }
  return objects;
}

export function decodeLevel(data: string): { grid: number[][]; objects: CompactObject[] } | null {
  const doc = parseDoc(data);
  if (!doc) return null;
  const flat = expandRuns(doc.r, doc.w * doc.h);
  const objects = parseObjects(doc.o);
  if (!flat || !objects) return null;
  const grid: number[][] = [];
  for (let r = 0; r < doc.h; r++) grid.push(flat.slice(r * doc.w, (r + 1) * doc.w));
  return { grid, objects };
}
