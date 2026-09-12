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
}

export const ESSENTIALS: ObjectDef[] = [
  { id: 151, name: 'Sonic Placer', desc: 'Spawn point for Sonic (required)' },
  { id: 44, name: 'Sign Post', desc: 'Goal sign post (required)' },
  { id: 36, name: 'Star Post', desc: 'Checkpoint post' },
];

export const RING_TYPES: ObjectDef[] = [
  { id: 0, name: 'Ring Row', desc: 'Horizontal ring line (+X)', isRing: true, ringLayout: 0 },
  { id: 1, name: 'Ring Column', desc: 'Vertical ring line (+Y)', isRing: true, ringLayout: 1 },
  { id: 63, name: 'Ring Diag -16', desc: 'Diagonal ring line (-16/+16)', isRing: true, ringLayout: 63 },
  { id: 64, name: 'Ring Diag +16', desc: 'Diagonal ring line (+16/+16)', isRing: true, ringLayout: 64 },
  { id: 65, name: 'Ring Diag +32', desc: 'Diagonal ring line (+32/+32)', isRing: true, ringLayout: 65 },
  { id: 66, name: 'Ring Horiz 16', desc: 'Horizontal ring line 16px', isRing: true, ringLayout: 66 },
  { id: 67, name: 'Ring Horiz 32', desc: 'Horizontal ring line 32px', isRing: true, ringLayout: 67 },
  { id: 68, name: 'Ring Vert 16', desc: 'Vertical ring line 16px', isRing: true, ringLayout: 68 },
  { id: 69, name: 'Ring Vert 32', desc: 'Vertical ring line 32px', isRing: true, ringLayout: 69 },
];

export const OBJECTS: ObjectDef[] = [
  { id: 2, name: 'Red Spring', desc: 'Red spring pad (bounces up)' },
  { id: 153, name: 'Yellow Spring', desc: 'Yellow spring pad (bounces up)' },
  { id: 9, name: 'Spikes', desc: 'Spike trap' },
  { id: 10, name: 'Monitor', desc: 'Item monitor (TV box)' },
  { id: 12, name: 'Platform', desc: 'Static platform' },
  { id: 17, name: 'Moving Platform', desc: 'Moving platform (patrol)' },
  { id: 32, name: 'Large Platform', desc: 'Large moving platform' },
  { id: 62, name: 'Platform Lamp', desc: 'Platform with lamp decoration' },
  { id: 83, name: 'DAI3 Platform', desc: 'Alternate platform variant' },
  { id: 11, name: 'Falling Block', desc: 'Block that falls when stepped on' },
  { id: 15, name: 'Switch', desc: 'Activates connected objects' },
  { id: 22, name: 'Fan', desc: 'Wind fan (blows upward)' },
  { id: 24, name: 'Conveyor', desc: 'Conveyor belt surface' },
  { id: 33, name: 'Elevator Rail', desc: 'Elevator on a rail' },
  { id: 73, name: 'Elevator', desc: 'Standard elevator platform' },
  { id: 47, name: 'Giant Ring', desc: 'Giant ring (special stage entry)' },
  { id: 45, name: 'Button', desc: 'Button / base plate' },
  { id: 102, name: 'Solid Block', desc: 'Solid collision block' },
  { id: 30, name: 'Door', desc: 'Door / gate' },
  { id: 4, name: 'Tall Bridge', desc: 'Tall bridge / pole' },
  { id: 5, name: 'Bridge', desc: 'Standard bridge' },
  { id: 6, name: 'Breakable Wall', desc: 'Breakable wall segment' },
  { id: 18, name: 'Breakable Wall GH', desc: 'Breakable wall (Green Hill)' },
  { id: 21, name: 'Steps', desc: 'Step platforms' },
  { id: 3, name: 'Swing', desc: 'Swinging platform' },
  { id: 7, name: 'Floor Block', desc: 'Solid floor piece' },
  { id: 29, name: 'Floor Trap', desc: 'Trap floor segment' },
];

export const ENEMIES: ObjectDef[] = [
  { id: 41, name: 'Musi', desc: 'Bug badnik (crawls on surfaces)' },
  { id: 40, name: 'Hachi', desc: 'Bee badnik (flies in patterns)' },
  { id: 86, name: 'Fish Chopper', desc: 'Chopper fish (jumps from water)' },
  { id: 39, name: 'Kamere', desc: 'Chameleon badnik (spits fireballs)' },
  { id: 57, name: 'Kani', desc: 'Crab badnik (walks and pinches)' },
  { id: 74, name: 'Uni', desc: 'Unibadnik (crawls on surfaces)' },
  { id: 51, name: 'Buta', desc: 'Pig badnik (charges forward)' },
  { id: 50, name: 'Brobo', desc: 'Robot badnik (shoots projectiles)' },
  { id: 49, name: 'Imo', desc: 'Caterpillar badnik (segmented)' },
  { id: 70, name: 'Armadillo', desc: 'Armadillo badnik (rolls and charges)' },
  { id: 71, name: 'Yado', desc: 'Hermit-crab badnik (retreats to shell)' },
  { id: 78, name: 'Bat', desc: 'Bat badnik (flies in swooping arcs)' },
  { id: 81, name: 'Mogura', desc: 'Mole badnik (pops from ground)' },
  { id: 25, name: 'Pata', desc: 'Flap enemy (hovers and drops)' },
  { id: 28, name: 'Mawaru', desc: 'Spinner badnik (rotates in place)' },
];

// Per-zone enemy subsets (zone 7 / custom = Green Hill set)
export const ZONE_ENEMIES: number[] = [41, 40, 86, 39, 57, 74, 51, 50, 49, 70, 71, 78, 81, 25, 28];

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
