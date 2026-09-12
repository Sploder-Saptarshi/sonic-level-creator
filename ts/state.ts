import {
  BLOCK_PX, DEFAULT_COLS, DEFAULT_ROWS, GRID_SNAP,
  ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES,
  countObjectsInTile, pixelToTile,
  PlacedObject, ObjectDef,
} from './format';

export type TabType = 'tiles' | 'objects' | 'rings' | 'enemies' | 'essentials';

/** Mutable editor state — single source of truth. */
export const S = {
  grid: [] as number[][],
  objects: [] as PlacedObject[],
  activeTab: 'tiles' as TabType,
  selectedTile: 1,
  selectedObj: null as ObjectDef | null,
  zoom: 2,
  spaceHeld: false,
  selectedObjIdx: -1,
  dragObj: null as PlacedObject | null,
  dragOffX: 0,
  dragOffY: 0,

  // Palette drag (started from thumbnail, ends on canvas)
  paletteDrag: false,
  paletteDragTile: 0,
  paletteDragDef: null as ObjectDef | null,

  // Pan state
  panning: false,
  panStartX: 0,
  panStartY: 0,
  panStartSX: 0,
  panStartSY: 0,

  // DOM refs (populated in boot)
  shadow: null as ShadowRoot | null,
  canvas: null as HTMLCanvasElement | null,
  ctx: null as CanvasRenderingContext2D | null,
  spritesheetImg: null as HTMLImageElement | null,
  thumbstrip: null as HTMLElement | null,
  descEl: null as HTMLElement | null,
  statusEl: null as HTMLElement | null,
  counterEl: null as HTMLElement | null,
  canvasWrap: null as HTMLElement | null,
  ghostEl: null as HTMLElement | null,
};

// ── Helpers ──

export function cellSize(): number {
  return Math.round(64 * S.zoom);
}

export function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
  S.grid = [];
  for (let r = 0; r < rows; r++) S.grid.push(new Array(cols).fill(0));
  S.objects = [];
  S.selectedObjIdx = -1;
}

export function inGrid(bx: number, by: number): boolean {
  return bx >= 0 && bx < S.grid[0].length && by >= 0 && by < S.grid.length;
}

export function setStatus(msg: string) {
  if (S.statusEl) S.statusEl.textContent = msg;
}

export function updateDesc(text: string) {
  if (S.descEl) S.descEl.textContent = text;
}

export function resetInteraction() {
  S.panning = false;
  S.dragObj = null;
}

/** Convert mouse event to grid + pixel coordinates (single source of truth). */
export function canvasToWorld(e: MouseEvent): { bx: number; by: number; px: number; py: number } {
  const rect = S.canvas!.getBoundingClientRect();
  const cs = cellSize();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  return {
    bx: Math.floor(mx / cs),
    by: Math.floor(my / cs),
    px: Math.floor(mx / cs * BLOCK_PX),
    py: Math.floor(my / cs * BLOCK_PX),
  };
}

/** Resolve tab to its object-definition list. */
export function defsForTab(tab: TabType): ObjectDef[] {
  if (tab === 'objects') return OBJECTS;
  if (tab === 'rings') return RING_TYPES;
  if (tab === 'enemies') return ENEMIES;
  return ESSENTIALS;
}

export function objectsInTile(tc: number, tr: number): number {
  return countObjectsInTile(S.objects, tc, tr);
}

export function totalObjects(): number {
  let c = 0;
  for (const o of S.objects) c += (o.type <= 1 || (o.type >= 63 && o.type <= 69)) ? 1 + o.sub : 1;
  return c;
}

export function countPlacedTiles(): number {
  let c = 0;
  for (const row of S.grid) for (const id of row) if (id > 0) c++;
  return c;
}

export function findDef(typeId: number): ObjectDef | null {
  for (const arr of [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES])
    for (const d of arr) if (d.id === typeId) return d;
  return null;
}
