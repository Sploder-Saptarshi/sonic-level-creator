// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import {
  BLOCK_PX, DEFAULT_COLS, DEFAULT_ROWS,
  ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES,
  type PlacedObject, type ObjectDef,
} from './format';

export type TabType = 'tiles' | 'objects' | 'rings' | 'enemies' | 'essentials';

export const S = {
  grid: [] as number[][],
  objects: [] as PlacedObject[],
  activeTab: 'tiles' as TabType,
  levelName: '',
  levelId: null as string | null,
  zoom: 2,
  spaceHeld: false,
  selectedObjIdx: -1,
  selectedTileBx: -1,
  selectedTileBy: -1,
  dragObj: null as PlacedObject | null,
  dragOffX: 0,
  dragOffY: 0,
  dragStartX: 0,
  dragStartY: 0,

  paletteDrag: false,
  paletteDragTile: 0,
  paletteDragDef: null as ObjectDef | null,

  previewPX: 0,
  previewPY: 0,
  previewOnCanvas: false,

  hoverBx: -1,
  hoverBy: -1,
  gloweyImg: null as HTMLImageElement | null,

  panning: false,
  panStartX: 0,
  panStartY: 0,
  panStartSX: 0,
  panStartSY: 0,

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

export function cellSize(): number {
  return Math.round(128 * effZoom());
}

// never zoom out past the point where the map stops filling the view
function effZoom(): number {
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
  clearSelection();
}

export function clearTileSelection() {
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
}

export function clearSelection() {
  S.selectedObjIdx = -1;
  clearTileSelection();
}

export function inGrid(bx: number, by: number): boolean {
  return bx >= 0 && bx < S.grid[0].length && by >= 0 && by < S.grid.length;
}

export function updateDesc(text: string) {
  if (S.descEl) S.descEl.textContent = text;
}

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

export function defsForTab(tab: TabType): ObjectDef[] {
  if (tab === 'objects') return OBJECTS;
  if (tab === 'rings') return RING_TYPES;
  if (tab === 'enemies') return ENEMIES;
  return ESSENTIALS;
}

export function totalObjects(): number {
  return S.objects.length;
}

export function countPlacedTiles(): number {
  let c = 0;
  for (const row of S.grid) for (const id of row) if (id > 0) c++;
  return c;
}

const ALL_DEFS = [...ESSENTIALS, ...RING_TYPES, ...OBJECTS, ...ENEMIES];

export function findDef(typeId: number): ObjectDef | null {
  return ALL_DEFS.find(d => d.id === typeId) ?? null;
}
