// Stored level -> the game's single comma-decimal string: BIN bytes followed
// by ACT bytes. The editor bundle reuses these encoders for test play.
import { decodeLevel, type CompactObject } from "./compact";

function pushU32(out: number[], v: number): void {
  out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

export function encodeBin(grid: number[][]): number[] {
  const rows = grid.length, cols = grid[0].length;
  const out: number[] = [];
  pushU32(out, 4);
  for (let layer = 0; layer < 4; layer++) {
    pushU32(out, rows);
    for (let r = 0; r < rows; r++) {
      pushU32(out, cols);
      for (let c = 0; c < cols; c++) pushU32(out, grid[r][c]);
    }
  }
  return out;
}

export function encodeAct(objects: CompactObject[]): number[] {
  // The SWF streams objects with forward-only cursors, so sort by X.
  const sorted = [...objects].sort((a, b) => a.x - b.x || a.y - b.y);
  const entries: number[] = [];
  for (const o of sorted) {
    entries.push(
      (o.x >>> 8) & 0xff, o.x & 0xff,
      (o.y >>> 8) & 0xff, o.y & 0xff,
      o.variant & 0xff, o.type & 0xff, o.sub & 0xff,
    );
  }
  const out: number[] = [];
  for (let t = 0; t < 4; t++) out.push((entries.length >>> 8) & 0xff, entries.length & 0xff);
  for (let t = 0; t < 4; t++) for (const b of entries) out.push(b);
  return out;
}

// Null on corrupt data.
export function levelToCsv(data: string): string | null {
  const parsed = decodeLevel(data);
  if (!parsed || !parsed.grid.length || !parsed.grid[0].length) return null;
  return encodeBin(parsed.grid).concat(encodeAct(parsed.objects)).join(",");
}
