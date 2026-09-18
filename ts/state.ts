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
  // Chosen on the "Start a new level" screen; used for the save filename.
  levelName: 'The Guide Zone',
  // Server row id once saved (null until the first server save).
  levelId: null as string | null,
  zoom: 2,
  spaceHeld: false,
  selectedObjIdx: -1,
  // Selected tile cell (block coords, -1 when nothing selected). Clicking a
  // filled cell selects it: draw() outlines it + paints a remove badge.
  selectedTileBx: -1,
  selectedTileBy: -1,
  dragObj: null as PlacedObject | null,
  dragOffX: 0,
  dragOffY: 0,

  // Palette drag (started from thumbnail, ends on canvas)
  paletteDrag: false,
  paletteDragTile: 0,
  paletteDragDef: null as ObjectDef | null,

  // Palette-drag drop preview (snapped world px, only live while the cursor
  // is over the canvas itself — canvas-drawn, no HTML duplication)
  previewPX: 0,
  previewPY: 0,
  previewOnCanvas: false,

  // Hover highlight (tile cell under the cursor, -1 when outside grid)
  hoverBx: -1,
  hoverBy: -1,
  gloweyImg: null as HTMLImageElement | null,

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
  counterEl: null as HTMLElement | null,
  canvasWrap: null as HTMLElement | null,
  ghostEl: null as HTMLElement | null,
};

// ── Helpers ──

export function cellSize(): number {
  return Math.round(128 * effZoom());
}

// Effective zoom: never smaller than the minimum that fills the viewport,
// so no zoom button can leave a blank canvas area. The buttons keep their
// labels (100%/50%/25%) — small maps just render larger than literal.
export function effZoom(): number {
  const cols = S.grid[0]?.length ?? 0, rows = S.grid.length;
  const wrap = S.canvasWrap;
  if (!cols || !rows || !wrap) return S.zoom;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (w <= 0 || h <= 0) return S.zoom;
  return Math.max(S.zoom, w / (128 * cols), h / (128 * rows));
}

export function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
  S.grid = [];
  for (let r = 0; r < rows; r++) S.grid.push(new Array(cols).fill(0));
  S.objects = [];
  S.selectedObjIdx = -1;
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
}

export function inGrid(bx: number, by: number): boolean {
  return bx >= 0 && bx < S.grid[0].length && by >= 0 && by < S.grid.length;
}

export function updateDesc(text: string) {
  if (S.descEl) S.descEl.textContent = text;
}

export function resetInteraction() {
  S.panning = false;
  S.dragObj = null;
}

/** Convert mouse event to grid + pixel coordinates (single source of truth).
 *  mx/my are absolute canvas-px coords (canvas is viewport-sized + sticky,
 *  so the wrap scroll offset is added back); bx/by the cell; px/py world. */
export function canvasToWorld(e: MouseEvent): { bx: number; by: number; px: number; py: number; mx: number; my: number } {
  const rect = S.canvas!.getBoundingClientRect();
  const cs = cellSize();
  const sx = S.canvasWrap ? S.canvasWrap.scrollLeft : 0;
  const sy = S.canvasWrap ? S.canvasWrap.scrollTop : 0;
  const mx = e.clientX - rect.left + sx;
  const my = e.clientY - rect.top + sy;
  return {
    bx: Math.floor(mx / cs),
    by: Math.floor(my / cs),
    px: Math.floor(mx / cs * BLOCK_PX),
    py: Math.floor(my / cs * BLOCK_PX),
    mx,
    my,
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
  // Global counter: every placed entry counts as one — a ring bunch is a
  // single object no matter how many rings it holds. (The per-tile budget
  // in countObjectsInTile still counts rings individually.)
  return S.objects.length;
}

export function countPlacedTiles(): number {
  let c = 0;
  for (const row of S.grid) for (const id of row) if (id > 0) c++;
  return c;
}

const defCache = new Map<string, ObjectDef | null>();
export function findDef(typeId: number, variant?: number, sub?: number): ObjectDef | null {
  // Memoized (pure lookup): draw() calls this per art-less object per frame.
  const key = `${typeId}|${variant ?? ''}|${sub ?? ''}`;
  const hit = defCache.get(key);
  if (hit !== undefined) return hit;
  const out = findDefUncached(typeId, variant, sub);
  defCache.set(key, out);
  return out;
}

function findDefUncached(typeId: number, variant?: number, sub?: number): ObjectDef | null {
  const pools = [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES];
  if (variant !== undefined || sub !== undefined) {
    for (const arr of pools)
      for (const d of arr)
        if (d.id === typeId
          && (variant === undefined || (d.variant ?? 0) === variant)
          && (sub === undefined || (d.sub ?? 0) === sub)) return d;
  }
  for (const arr of pools)
    for (const d of arr) if (d.id === typeId) return d;
  return null;
}
