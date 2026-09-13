// ts/format.ts — types, object-definition tables, BIN/ACT encoders, CSV, tile-counter

export const TILE_PX = 16;
export const BLOCK_PX = 256;
export const DEFAULT_COLS = 64;
export const DEFAULT_ROWS = 12;
export const MAX_OBJECTS_PER_TILE = 7;
export const GRID_SNAP = 8;

// --- Object definitions per tab ---
export interface ObjectDef {
  id: number;
  name: string;
  desc: string;
  isRing?: boolean;
  ringLayout?: number;
  // Subtype bytes written on placement (ACT byte 4 = variant/facing,
  // ACT byte 6 = sub). Enemies use mirrored R-subtypes for initial
  // direction (variant 1); objects use duplicated tray entries per
  // verified sub/variant combo (spring orientation, spike width,
  // monitor contents, platform behavior, ...).
  variant?: number;
  mirror?: boolean;
  sub?: number;
}

export const ESSENTIALS: ObjectDef[] = [
  { id: 151, name: 'Sonic Placer', desc: 'Spawn point for Sonic (required)' },
  { id: 44, name: 'Sign Post', desc: 'Goal sign post (required)' },
  { id: 36, name: 'Star Post', desc: 'Checkpoint post' },
];

// Ring layouts: type selects the fan-out direction/steps (see §6.1),
// sub fans out to 1 + sub rings. One tray entry per (layout × count),
// like the object subtype entries — counts 1..7 cover the stock GH range
// (stock ZONE1ACT uses subs 0..6) and the 7-objects-per-tile budget.
// The single-ring placement (sub 0) is kept only for the first horizontal
// layout; all other layouts start at count 2 (sub 1+) since a lone ring is
// directionless. 9 layouts × 7 counts − 8 removed = 55 entries.
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
    // Skip the single-ring placement (sub 0) for every layout except the
    // first horizontal row — a lone ring is directionless, so only the
    // canonical Ring Row keeps its count-1 entry.
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
  // Springs (type 2): sub/16 orientation (0 up, 1 sideways, 2+ down),
  // sub%16==2 yellow art + weak bounce; sideways facing by variant.
  // Stock GH: yellow-up x15, red-side-R (16,1) x6.
  // Tray order is flat but grouped by family: all red subtypes, then
  // all yellow subtypes (up -> sideways R/L -> down).
  { id: 2, name: 'Red Spring', desc: 'Red spring pad (bounces up)', sub: 0 },
  { id: 2, name: 'Red Spring R', desc: 'Sideways red spring (faces right)', variant: 0, sub: 16 },
  { id: 2, name: 'Red Spring L', desc: 'Sideways red spring (faces left, stock GH)', variant: 1, sub: 16 },
  { id: 2, name: 'Red Spring Down', desc: 'Ceiling red spring (bounces down)', sub: 32 },
  { id: 2, name: 'Yellow Spring', desc: 'Yellow spring pad, weak bounce (stock GH)', sub: 2 },
  { id: 2, name: 'Yellow Spring R', desc: 'Sideways yellow spring, weak (faces right)', variant: 0, sub: 18 },
  { id: 2, name: 'Yellow Spring L', desc: 'Sideways yellow spring, weak (faces left)', variant: 1, sub: 18 },
  { id: 2, name: 'Yellow Spring Down', desc: 'Ceiling yellow spring, weak', sub: 34 },
  // Spikes (type 9): width/orientation by sub; variant 2 = ceiling (ROT180),
  // wall subs (16/18/82) face by variant 0/1. Stock GH: 0/32/48/64 + one 16.
  // Tray order is flat, sorted by spike count ascending (1 -> 3 -> 5 -> 6),
  // then by gap ascending (contiguous sheet before spaced columns; the
  // ceiling twin sits right after its floor twin, wall singles before
  // full-wall sheets). Counts: sub 32 / 82 = 1 spike, sub 48 = 3 spikes
  // at 24px spacing, sub 0 / 16 / 18 = 5 contiguous spikes, sub 64 =
  // 6 spikes at 24px spacing (see spike_draw in MainCanvas.as).
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
  // Switch (type 15): sub = switchflag index it drives. No stock GH usage.
  { id: 15, name: 'Switch 0', desc: 'Switch driving flag 0', sub: 0 },
  { id: 15, name: 'Switch 1', desc: 'Switch driving flag 1', sub: 1 },
  { id: 15, name: 'Switch 2', desc: 'Switch driving flag 2', sub: 2 },
  // Buttons (type 45): sub selects art row (0/3 row 0, 1 row 2, else row 1).
  // Invisible in-game until touched; editor previews idle art. Stock GH: 1/2/3.
  { id: 45, name: 'Button 1', desc: 'Button sub 1 (stock GH; shows when touched)', sub: 1 },
  { id: 45, name: 'Button 2', desc: 'Button sub 2 (stock GH; shows when touched)', sub: 2 },
  { id: 45, name: 'Button 3', desc: 'Button sub 3 (stock GH; shows when touched)', sub: 3 },
  // Monitors (type 43 = stock GH flavor): sub = contents
  // (1 dud, 2 1UP, 3 speed, 4 shield, 5 invinc, 6 rings; 0 dead, 7+ invisible).
  { id: 43, name: 'Monitor Dud', desc: 'Empty monitor (stock art row 0)', sub: 1 },
  { id: 43, name: 'Monitor 1UP', desc: 'Extra-life monitor (stock GH)', sub: 2 },
  { id: 43, name: 'Monitor Speed', desc: 'Speed-shoes monitor (stock GH)', sub: 3 },
  { id: 43, name: 'Monitor Shield', desc: 'Shield monitor (stock GH)', sub: 4 },
  { id: 43, name: 'Monitor Invinc', desc: 'Invincibility monitor (stock GH)', sub: 5 },
  { id: 43, name: 'Monitor Rings', desc: '10-rings monitor (stock GH)', sub: 6 },
  // Tall bridge (type 4, stock sub 16) / standard bridge (type 5, stock sub 12)
  { id: 4, name: 'Tall Bridge', desc: 'Tall bridge / pole (stock GH sub 16)', sub: 16 },
  { id: 5, name: 'Bridge', desc: 'Standard bridge (stock GH sub 12)', sub: 12 },
  // Bridge edge (type 38, stock sub 3): variant 0 mirrored, else normal.
  { id: 38, name: 'Bridge Edge L', desc: 'Bridge end, mirrored (stock GH)', variant: 0, mirror: true, sub: 3 },
  { id: 38, name: 'Bridge Edge R', desc: 'Bridge end, normal (stock GH)', variant: 1, sub: 3 },
  // Breakable wall (type 6): sub != 0 mirrors debris. Stock: (0,0) + (1,1).
  { id: 6, name: 'Breakable Wall', desc: 'Breakable wall segment (stock GH)', sub: 0 },
  { id: 6, name: 'Breakable Wall M', desc: 'Breakable wall, mirrored debris (stock GH)', variant: 1, mirror: true, sub: 1 },
  // GH breakable (type 18): sub 0/1/2 visual styles, all in stock GH.
  { id: 18, name: 'Break Wall A', desc: 'GH breakable wall, style A (stock GH)', sub: 0 },
  { id: 18, name: 'Break Wall B', desc: 'GH breakable wall, style B (stock GH)', sub: 1 },
  { id: 18, name: 'Break Wall C', desc: 'GH breakable wall, style C (stock GH)', sub: 2 },
  // Swing (type 3): sub = chain length - 1 (stock 6/7/8); sub 5 or
  // variant 1 reverses swing direction (same idle art).
  { id: 3, name: 'Swing S', desc: 'Swinging platform, short (stock GH sub 6)', sub: 6 },
  { id: 3, name: 'Swing M', desc: 'Swinging platform, medium (stock GH sub 7)', sub: 7 },
  { id: 3, name: 'Swing L', desc: 'Swinging platform, long (stock GH sub 8)', sub: 8 },
  { id: 3, name: 'Swing Reverse', desc: 'Short swing, reversed direction (variant 1)', variant: 1, sub: 6 },
  // Shima platforms (type 16): motion by sub (same idle art except pillar).
  // Stock 16: 0/1/2/3/5/6. Pillar art only for sub 16.
  { id: 16, name: 'Shima Platform', desc: 'GH floating platform, static', sub: 0 },
  { id: 16, name: 'Shima Mover H', desc: 'Platform moving horizontally (first LEFT, stock GH)', sub: 1 },
  { id: 16, name: 'Shima Mover V', desc: 'Platform moving vertically (first UP, stock GH)', sub: 2 },
  { id: 16, name: 'Shima Crumble', desc: 'Crumbling platform (falls DOWN, stock GH)', sub: 3 },
  { id: 16, name: 'Shima Pillar', desc: 'Tall pillar platform (bobs vertically, sub 16 art)', sub: 16 },
  { id: 16, name: 'Shima Switch', desc: 'Switch-rise platform (rises UP, flag 128)', sub: 7 },
  // Kageb blocks (type 37): sub 0/1/2 solid frames, 16/17/18 decor frames.
  // All six in stock GH; other subs < 16 fall back to frame 0 art.
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

// Per-zone enemy subsets (zone 7 / custom = Green Hill set)
export const ZONE_ENEMIES: number[] = [41, 40, 86, 39, 57];

// --- Block spritesheet layout ---
export const SHEET_SIZE = 4096;
export const SHEET_COLS = 16;
export const SHEET_BLOCK_SIZE = SHEET_SIZE / SHEET_COLS; // 256
export const TOTAL_BLOCKS = 256;
export const USED_BLOCKS = 135;

export function blockSheetXY(id: number): { x: number; y: number } {
  return {
    x: (id % SHEET_COLS) * SHEET_BLOCK_SIZE,
    y: Math.floor(id / SHEET_COLS) * SHEET_BLOCK_SIZE,
  };
}

// --- BIN encoder (4 identical layers, u32 BE) ---
export function encodeBin(grid: number[][]): number[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const out: number[] = [];
  function pushU32(v: number) {
    out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }
  pushU32(4); // layer count
  for (let layer = 0; layer < 4; layer++) {
    pushU32(rows);
    for (let r = 0; r < rows; r++) {
      pushU32(cols);
      for (let c = 0; c < cols; c++) {
        pushU32(grid[r][c]);
      }
    }
  }
  return out;
}

// --- ACT encoder (4 identical tables, u16 length + byte entries) ---
export interface PlacedObject {
  x: number; // level pixels
  y: number;
  variant: number; // byte 4
  type: number;    // byte 5
  sub: number;     // byte 6
}

export function encodeAct(objects: PlacedObject[]): number[] {
  const entries: number[] = [];
  for (const obj of objects) {
    // ACT X/Y are raw world pixels — write through untouched (WYSIWYG).
    entries.push(
      (obj.x >>> 8) & 0xff, obj.x & 0xff,
      (obj.y >>> 8) & 0xff, obj.y & 0xff,
      obj.variant & 0xff, obj.type & 0xff, obj.sub & 0xff,
    );
  }
  const tableLen = entries.length;
  const out: number[] = [];
  // 4 u16 BE lengths
  for (let t = 0; t < 4; t++) {
    out.push((tableLen >>> 8) & 0xff, tableLen & 0xff);
  }
  // 4 copies of table data
  for (let t = 0; t < 4; t++) {
    for (const b of entries) out.push(b);
  }
  return out;
}

// --- CSV conversion ---
export function toCSV(binBytes: number[], actBytes: number[]): string {
  const all = binBytes.concat(actBytes);
  return all.join(',');
}

// --- Tile counter: count objects in a given tile ---
export function countObjectsInTile(
  objects: PlacedObject[],
  tileCol: number,
  tileRow: number,
): number {
  let count = 0;
  for (const obj of objects) {
    const tc = Math.floor(obj.x / BLOCK_PX);
    const tr = Math.floor(obj.y / BLOCK_PX);
    if (tc === tileCol && tr === tileRow) {
      // rings count as 1 + sub
      count += obj.type <= 1 || (obj.type >= 63 && obj.type <= 69) ? 1 + obj.sub : 1;
    }
  }
  return count;
}

// --- Snap to grid ---
export function snap8(v: number): number {
  return Math.round(v / GRID_SNAP) * GRID_SNAP;
}

export function pixelToTile(px: number): number {
  return Math.floor(px / BLOCK_PX);
}

export function tileToPixel(tile: number): number {
  return tile * BLOCK_PX;
}
