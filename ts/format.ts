// Level format: object tables, BIN/ACT encoding and per-tile object budgets.

export const BLOCK_PX = 256;
export const DEFAULT_COLS = 64;
export const DEFAULT_ROWS = 12;
export const MAX_OBJECTS_PER_TILE = 7;
export const GRID_SNAP = 8;

export interface ObjectDef {
  id: number;
  name: string;
  desc: string;
  isRing?: boolean;
  ringLayout?: number;
  // Written on placement: ACT byte 4 (variant, also facing) and byte 6 (sub).
  // Each verified variant/sub combination gets its own tray entry.
  variant?: number;
  mirror?: boolean;
  sub?: number;
}

export const ESSENTIALS: ObjectDef[] = [
  { id: 151, name: 'Sonic Placer', desc: 'Spawn point for Sonic (required)' },
  { id: 44, name: 'Sign Post', desc: 'Goal sign post (required)' },
  { id: 36, name: 'Star Post', desc: 'Checkpoint post' },
];

// The ring type picks the fan-out direction; a bunch holds 1 + sub rings.
// One tray entry per layout and count (1..7, the per-tile budget). Only Ring
// Row keeps a single-ring entry, since a lone ring has no direction.
const RING_LAYOUTS: { id: number; base: string; desc: string }[] = [
  { id: 0, base: 'Ring Row', desc: 'Horizontal ring line (+X)' },
  { id: 1, base: 'Ring Column', desc: 'Vertical ring line (+Y)' },
  { id: 63, base: 'Ring Diag -16', desc: 'Diagonal ring line (-16/+16)' },
  { id: 64, base: 'Ring Diag +16', desc: 'Diagonal ring line (+16/+16)' },
  { id: 65, base: 'Ring Diag +32', desc: 'Diagonal ring line (+32/+32)' },
  { id: 66, base: 'Ring Horiz 16', desc: 'Horizontal ring line 16px steps' },
  { id: 67, base: 'Ring Horiz 32', desc: 'Horizontal ring line 32px steps' },
  { id: 68, base: 'Ring Vert 16', desc: 'Vertical ring line 16px steps' },
  { id: 69, base: 'Ring Vert 32', desc: 'Vertical ring line 32px steps' },
];

export const RING_TYPES: ObjectDef[] = [];
for (let li = 0; li < RING_LAYOUTS.length; li++) {
  const layout = RING_LAYOUTS[li];
  for (let n = 1; n <= 7; n++) {
    if (n === 1 && li !== 0) continue;
    RING_TYPES.push({
      id: layout.id,
      name: n === 1 ? layout.base : `${layout.base} ×${n}`,
      desc: `${layout.desc}, ${n} ring${n === 1 ? '' : 's'}`,
      isRing: true,
      ringLayout: layout.id,
      sub: n - 1,
    });
  }
}

export const OBJECTS: ObjectDef[] = [
  // Springs (type 2): sub/16 is the orientation (0 up, 1 sideways, 2+ down),
  // sub%16 == 2 is yellow (weak). Variant sets the sideways facing.
  { id: 2, name: 'Red Spring', desc: 'Red spring pad (bounces up)', sub: 0 },
  { id: 2, name: 'Red Spring R', desc: 'Sideways red spring (faces right)', variant: 0, sub: 16 },
  { id: 2, name: 'Red Spring L', desc: 'Sideways red spring (faces left, stock GH)', variant: 1, sub: 16 },
  { id: 2, name: 'Red Spring Down', desc: 'Ceiling red spring (bounces down)', sub: 32 },
  { id: 2, name: 'Yellow Spring', desc: 'Yellow spring pad, weak bounce (stock GH)', sub: 2 },
  { id: 2, name: 'Yellow Spring R', desc: 'Sideways yellow spring, weak (faces right)', variant: 0, sub: 18 },
  { id: 2, name: 'Yellow Spring L', desc: 'Sideways yellow spring, weak (faces left)', variant: 1, sub: 18 },
  { id: 2, name: 'Yellow Spring Down', desc: 'Ceiling yellow spring, weak', sub: 34 },
  // Spikes (type 9): sub sets width/orientation, variant 2 flips to the
  // ceiling, and wall subs (16/18/82) face by variant. Sorted by spike count:
  // sub 32/82 = 1, 48 = 3, 0/16/18 = 5, 64 = 6 (spike_draw in MainCanvas.as).
  { id: 9, name: 'Spikes Narrow', desc: 'Single-column spikes (stock GH)', sub: 32 },
  { id: 9, name: 'Spikes Single L', desc: 'Single wall spike (faces left)', variant: 0, sub: 82 },
  { id: 9, name: 'Spikes Single R', desc: 'Single wall spike (faces right)', variant: 1, sub: 82 },
  { id: 9, name: 'Spikes Triple', desc: 'Triple spikes (stock GH)', sub: 48 },
  { id: 9, name: 'Spikes', desc: 'Spike trap (floor, stock GH)', sub: 0 },
  { id: 9, name: 'Spikes Ceiling', desc: 'Spike trap (ceiling, variant 2)', variant: 2, sub: 0 },
  { id: 9, name: 'Spikes Wall L', desc: 'Wall spikes (faces left, stock GH)', variant: 0, sub: 16 },
  { id: 9, name: 'Spikes Wall R', desc: 'Wall spikes (faces right)', variant: 1, sub: 16 },
  { id: 9, name: 'Spikes Wall 18', desc: 'Sliding wall spikes, sub 18 (extends on a timer)', variant: 0, sub: 18 },
  { id: 9, name: 'Spikes Wide', desc: 'Six-column spikes (stock GH)', sub: 64 },
  // Switch (type 15): sub is the switch flag it drives.
  { id: 15, name: 'Switch 0', desc: 'Switch driving flag 0', sub: 0 },
  { id: 15, name: 'Switch 1', desc: 'Switch driving flag 1', sub: 1 },
  { id: 15, name: 'Switch 2', desc: 'Switch driving flag 2', sub: 2 },
  // Buttons (type 45): sub picks the art row. Invisible in-game until touched.
  { id: 45, name: 'Button 1', desc: 'Button sub 1 (stock GH; shows when touched)', sub: 1 },
  { id: 45, name: 'Button 2', desc: 'Button sub 2 (stock GH; shows when touched)', sub: 2 },
  { id: 45, name: 'Button 3', desc: 'Button sub 3 (stock GH; shows when touched)', sub: 3 },
  // Monitors (type 43): sub is the contents (0 dead, 7+ invisible).
  { id: 43, name: 'Monitor Dud', desc: 'Empty monitor (stock art row 0)', sub: 1 },
  { id: 43, name: 'Monitor 1UP', desc: 'Extra-life monitor (stock GH)', sub: 2 },
  { id: 43, name: 'Monitor Speed', desc: 'Speed-shoes monitor (stock GH)', sub: 3 },
  { id: 43, name: 'Monitor Shield', desc: 'Shield monitor (stock GH)', sub: 4 },
  { id: 43, name: 'Monitor Invinc', desc: 'Invincibility monitor (stock GH)', sub: 5 },
  { id: 43, name: 'Monitor Rings', desc: '10-rings monitor (stock GH)', sub: 6 },
  { id: 4, name: 'Tall Bridge', desc: 'Tall bridge / pole (stock GH sub 16)', sub: 16 },
  { id: 5, name: 'Bridge', desc: 'Standard bridge (stock GH sub 12)', sub: 12 },
  { id: 38, name: 'Bridge Edge L', desc: 'Bridge end, mirrored (stock GH)', variant: 0, mirror: true, sub: 3 },
  { id: 38, name: 'Bridge Edge R', desc: 'Bridge end, normal (stock GH)', variant: 1, sub: 3 },
  // Breakable wall (type 6): sub != 0 mirrors the debris.
  { id: 6, name: 'Breakable Wall', desc: 'Breakable wall segment (stock GH)', sub: 0 },
  { id: 6, name: 'Breakable Wall M', desc: 'Breakable wall, mirrored debris (stock GH)', variant: 1, mirror: true, sub: 1 },
  { id: 18, name: 'Break Wall A', desc: 'GH breakable wall, style A (stock GH)', sub: 0 },
  { id: 18, name: 'Break Wall B', desc: 'GH breakable wall, style B (stock GH)', sub: 1 },
  { id: 18, name: 'Break Wall C', desc: 'GH breakable wall, style C (stock GH)', sub: 2 },
  // Swing (type 3): sub is chain length - 1; variant 1 reverses direction.
  { id: 3, name: 'Swing S', desc: 'Swinging platform, short (stock GH sub 6)', sub: 6 },
  { id: 3, name: 'Swing M', desc: 'Swinging platform, medium (stock GH sub 7)', sub: 7 },
  { id: 3, name: 'Swing L', desc: 'Swinging platform, long (stock GH sub 8)', sub: 8 },
  { id: 3, name: 'Swing Reverse', desc: 'Short swing, reversed direction (variant 1)', variant: 1, sub: 6 },
  // Shima platforms (type 16): sub sets the motion; only sub 16 has pillar art.
  { id: 16, name: 'Shima Platform', desc: 'GH floating platform, static', sub: 0 },
  { id: 16, name: 'Shima Mover H', desc: 'Platform moving horizontally (first LEFT, stock GH)', sub: 1 },
  { id: 16, name: 'Shima Mover V', desc: 'Platform moving vertically (first UP, stock GH)', sub: 2 },
  { id: 16, name: 'Shima Crumble', desc: 'Crumbling platform (falls DOWN, stock GH)', sub: 3 },
  { id: 16, name: 'Shima Pillar', desc: 'Tall pillar platform (bobs vertically, sub 16 art)', sub: 16 },
  { id: 16, name: 'Shima Switch', desc: 'Switch-rise platform (rises UP, flag 128)', sub: 7 },
  // Kageb blocks (type 37): sub 0-2 solid frames, 16-18 decor frames.
  { id: 37, name: 'Kageb A', desc: 'GH block, solid frame 0 (stock GH)', sub: 0 },
  { id: 37, name: 'Kageb B', desc: 'GH block, solid frame 1 (stock GH)', sub: 1 },
  { id: 37, name: 'Kageb C', desc: 'GH block, solid frame 2 (stock GH)', sub: 2 },
  { id: 37, name: 'Kageb Decor A', desc: 'GH block, decor frame 3 (stock GH)', sub: 16 },
  { id: 37, name: 'Kageb Decor B', desc: 'GH block, decor frame 4 (stock GH)', sub: 17 },
  { id: 37, name: 'Kageb Decor C', desc: 'GH block, decor frame 5 (stock GH)', sub: 18 },
  { id: 58, name: 'Jyama', desc: 'Green Hill gimmick' },
];

export const ENEMIES: ObjectDef[] = [
  { id: 41, name: 'Musi', desc: 'Bug badnik (crawls left)' },
  { id: 41, name: 'Musi R', desc: 'Bug badnik (crawls right)', variant: 1, mirror: true },
  { id: 40, name: 'Hachi', desc: 'Bee badnik (patrols left)' },
  { id: 40, name: 'Hachi R', desc: 'Bee badnik (patrols right)', variant: 1, mirror: true },
  { id: 86, name: 'Fish Chopper', desc: 'Chopper fish (jumps from water)' },
  { id: 39, name: 'Kamere', desc: 'Chameleon badnik (faces left)' },
  { id: 39, name: 'Kamere R', desc: 'Chameleon badnik (faces right)', variant: 1, mirror: true },
  { id: 39, name: 'Kamere Turret', desc: 'Chameleon turret, stationary (faces left)', sub: 1 },
  { id: 39, name: 'Kamere Turret R', desc: 'Chameleon turret, stationary (faces right)', variant: 1, mirror: true, sub: 1 },
  { id: 57, name: 'Kani', desc: 'Crab badnik (walks left)' },
  { id: 57, name: 'Kani R', desc: 'Crab badnik (walks right)', variant: 1, mirror: true },
];

// Block spritesheet: 16x16 grid of 256px blocks.
export const SHEET_SIZE = 4096;
export const SHEET_COLS = 16;
export const SHEET_BLOCK_SIZE = SHEET_SIZE / SHEET_COLS;
export const TOTAL_BLOCKS = 256;
export const USED_BLOCKS = 135;

export function blockSheetXY(id: number): { x: number; y: number } {
  return {
    x: (id % SHEET_COLS) * SHEET_BLOCK_SIZE,
    y: Math.floor(id / SHEET_COLS) * SHEET_BLOCK_SIZE,
  };
}

// ACT entry (x/y are raw world pixels).
export interface PlacedObject {
  x: number;
  y: number;
  variant: number;
  type: number;
  sub: number;
}

export function toCSV(binBytes: number[], actBytes: number[]): string {
  return binBytes.concat(actBytes).join(',');
}

// Shared with the server so the editor and the gateway encode identically.
export { encodeCompact, decodeLevel, type CompactObject } from "../server/utils/compact";
export { encodeBin, encodeAct } from "../server/utils/levelBytes";

// Per-tile budget: each ring of a bunch counts toward the tile it lands in,
// so a bunch can spill into a neighbouring tile (at most one, since the
// longest fan-out is 192px).
export function isRingType(type: number): boolean {
  return type <= 1 || (type >= 63 && type <= 69);
}

// Fan-out step per ring layout, in world px.
export const RING_STEPS: Record<number, [number, number]> = {
  0: [24, 0], 1: [0, 24],
  63: [-16, 16], 64: [16, 16], 65: [32, 32],
  66: [16, 0], 67: [32, 0], 68: [0, 16], 69: [0, 32],
};

/** Live ring positions of a bunch: anchor + fan-out offsets. */
export function ringPositions(type: number, sub: number, x: number, y: number): Array<{ x: number; y: number }> {
  const [dx, dy] = RING_STEPS[type] ?? [0, 0];
  const n = 1 + sub;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) out.push({ x: x + i * dx, y: y + i * dy });
  return out;
}

/** Live objects one entry adds to the given tile. */
export function objectTileCostInTile(
  type: number, sub: number, x: number, y: number,
  tileCol: number, tileRow: number,
): number {
  if (!isRingType(type)) {
    return pixelToTile(x) === tileCol && pixelToTile(y) === tileRow ? 1 : 0;
  }
  let c = 0;
  for (const p of ringPositions(type, sub, x, y)) {
    if (pixelToTile(p.x) === tileCol && pixelToTile(p.y) === tileRow) c++;
  }
  return c;
}

/** Every tile one entry touches. */
export function objectTiles(type: number, sub: number, x: number, y: number): Array<{ tc: number; tr: number }> {
  const seen = new Map<string, { tc: number; tr: number }>();
  const touch = (px: number, py: number) => {
    const tc = pixelToTile(px), tr = pixelToTile(py);
    const k = tc + ',' + tr;
    if (!seen.has(k)) seen.set(k, { tc, tr });
  };
  if (!isRingType(type)) touch(x, y);
  else for (const p of ringPositions(type, sub, x, y)) touch(p.x, p.y);
  return [...seen.values()];
}

export function countObjectsInTile(
  objects: PlacedObject[],
  tileCol: number,
  tileRow: number,
  except?: PlacedObject,
): number {
  let count = 0;
  for (const obj of objects) {
    if (obj === except) continue;
    count += objectTileCostInTile(obj.type, obj.sub, obj.x, obj.y, tileCol, tileRow);
  }
  return count;
}

export function snap8(v: number): number {
  return Math.round(v / GRID_SNAP) * GRID_SNAP;
}

export function pixelToTile(px: number): number {
  return Math.floor(px / BLOCK_PX);
}
