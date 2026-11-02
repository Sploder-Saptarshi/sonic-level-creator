import {
  MAX_OBJECTS_PER_TILE, SONIC_TYPE, GOAL_TYPE, objectTileCostInTile, objectTiles,
  countObjectsInTile, snap8, pixelToTile, type ObjectDef, type PlacedObject,
} from './format';
import {
  S, inGrid, canvasToWorld, totalObjects, countPlacedTiles,
  cellSize, updateDesc, clearSelection, clearTileSelection, type TabType,
} from './state';
import { draw, requestDraw, updateGhost, hideGhost, ensureGlowLoop, hitTileBadge, objectHitIndex } from './render';
import { updateCounter, switchTab } from './thumbnails';
import { query, queryAll } from './dom';
import { hidePopup, showDeleteError, showPlaceError } from './popup';
import { doClearAll, doSave, doShare } from './levelStore';
import { doTest, markDirty, stopTest } from './testMode';
import { doFullscreen } from './fullscreen';
import { resizeCanvas, setZoom } from './viewport';

// document listeners see the shadow host as the target
function realTarget(e: Event): EventTarget | null {
  return e.composedPath()[0] ?? e.target;
}

function rejectWithPopup(msg: string, show: (msg: string) => void) {
  updateDesc(msg);
  show(msg);
}

// every object needs a placed tile
function tileClearBlocked(bx: number, by: number): string | null {
  if (S.grid[by][bx] <= 0) return null;
  const total = totalObjects(), tiles = countPlacedTiles();
  if (total > tiles - 1) {
    return `This tile cannot be removed. There are ${total} objects for ${tiles} placed tiles. Delete an object first, then remove the tile.`;
  }
  return null;
}

function rejectTileClear(bx: number, by: number): boolean {
  const why = tileClearBlocked(bx, by);
  if (why) rejectWithPopup(why, showDeleteError);
  return why !== null;
}

function tileCrowdedReason(type: number, sub: number, x: number, y: number, except?: PlacedObject): string | null {
  for (const t of objectTiles(type, sub, x, y)) {
    const others = countObjectsInTile(S.objects, t.tc, t.tr, except);
    const added = objectTileCostInTile(type, sub, x, y, t.tc, t.tr);
    if (others + added <= MAX_OBJECTS_PER_TILE) continue;
    return added > 1
      ? `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects and this ring bunch needs room for ${added}. Try a tile with more room.`
      : `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects. Try a tile with more room.`;
  }
  return null;
}

function startObjectDrag(index: number, px: number, py: number) {
  const o = S.objects[index];
  S.selectedObjIdx = index;
  S.dragObj = o;
  S.dragOffX = px - o.x;
  S.dragOffY = py - o.y;
  S.dragStartX = o.x;
  S.dragStartY = o.y;
  clearTileSelection();
}

function selectAt(bx: number, by: number, px: number, py: number, mx: number, my: number) {
  const hit = objectHitIndex(mx, my);
  if (hit >= 0) {
    startObjectDrag(hit, px, py);
  } else {
    S.selectedObjIdx = -1;
    S.dragObj = null;
    if (S.grid[by][bx] > 0) {
      S.selectedTileBx = bx;
      S.selectedTileBy = by;
    } else {
      clearTileSelection();
    }
  }
  updateCounter();
  draw();
}

function startPan(e: MouseEvent) {
  S.panning = true;
  S.panStartX = e.clientX;
  S.panStartY = e.clientY;
  S.panStartSX = S.canvasWrap!.scrollLeft;
  S.panStartSY = S.canvasWrap!.scrollTop;
  S.canvas!.style.cursor = 'grabbing';
}

function clearSelectedTile() {
  if (rejectTileClear(S.selectedTileBx, S.selectedTileBy)) return;
  S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
  clearSelection();
  S.dragObj = null;
  updateCounter();
  draw();
}

function eraseAt(bx: number, by: number) {
  const top = S.objects.map((o, i) => ({ o, i }))
    .reverse()
    .find(({ o }) => pixelToTile(o.x) === bx && pixelToTile(o.y) === by);
  if (top) {
    S.objects.splice(top.i, 1);
  } else {
    if (rejectTileClear(bx, by)) return;
    S.grid[by][bx] = 0;
  }
  S.selectedObjIdx = -1;
  S.dragObj = null;
  if (S.selectedTileBx === bx && S.selectedTileBy === by) clearTileSelection();
  updateCounter();
  markDirty();
  draw();
}

function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  const { bx, by, px, py, mx, my } = canvasToWorld(e);
  if (S.spaceHeld || e.button === 1) {
    startPan(e);
    return;
  }
  // before the bounds check: the badge can hang off the grid edge
  if (e.button === 0 && hitTileBadge(mx, my, cellSize())) {
    clearSelectedTile();
    return;
  }
  if (!inGrid(bx, by)) return;
  if (e.button === 2) {
    eraseAt(bx, by);
    return;
  }
  const canSelect = S.activeTab !== 'tiles' || (e.button === 0 && !S.paletteDrag);
  if (canSelect) selectAt(bx, by, px, py, mx, my);
}

function onMouseMove(e: MouseEvent) {
  const { bx, by, px, py, mx, my } = canvasToWorld(e);
  const inside = inGrid(bx, by);
  S.hoverBx = inside ? bx : -1;
  S.hoverBy = inside ? by : -1;

  if (S.panning) {
    S.canvasWrap!.scrollLeft = S.panStartSX - (e.clientX - S.panStartX);
    S.canvasWrap!.scrollTop = S.panStartSY - (e.clientY - S.panStartY);
    requestDraw();
    return;
  }

  S.canvas!.style.cursor = S.spaceHeld ? 'grab'
    : hitTileBadge(mx, my, cellSize()) ? 'pointer' : 'crosshair';

  if (S.dragObj && S.selectedObjIdx >= 0) {
    S.dragObj.x = snap8(px - S.dragOffX);
    S.dragObj.y = snap8(py - S.dragOffY);
    updateCounter();
  }

  if (S.paletteDrag) {
    S.previewOnCanvas = inside;
    S.previewPX = snap8(px);
    S.previewPY = snap8(py);
  }

  requestDraw();
  ensureGlowLoop();
}

function finishObjectDrag() {
  const o = S.dragObj;
  if (!o || S.selectedObjIdx < 0) return;
  const crowded = tileCrowdedReason(o.type, o.sub, o.x, o.y, o);
  if (!crowded) return;
  o.x = S.dragStartX;
  o.y = S.dragStartY;
  rejectWithPopup(crowded, showPlaceError);
}

function onMouseUp() {
  S.panning = false;
  finishObjectDrag();
  S.dragObj = null;
  S.canvas!.style.cursor = S.spaceHeld ? 'grab' : 'crosshair';
  draw();
}

function onMouseLeave() {
  S.panning = false;
  finishObjectDrag();
  S.dragObj = null;
  S.hoverBx = -1;
  S.hoverBy = -1;
  S.previewOnCanvas = false;
  S.canvas!.style.cursor = S.spaceHeld ? 'grab' : 'crosshair';
  draw();
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
}

function isTypingName(e: KeyboardEvent): boolean {
  const t = realTarget(e);
  return t instanceof HTMLElement && t.classList.contains('start-name');
}

function deleteSelection() {
  if (S.selectedObjIdx >= 0) {
    S.objects.splice(S.selectedObjIdx, 1);
    S.selectedObjIdx = -1;
  } else if (S.selectedTileBx >= 0 && S.selectedTileBy >= 0
    && S.selectedTileBy < S.grid.length && S.selectedTileBx < S.grid[0].length) {
    if (rejectTileClear(S.selectedTileBx, S.selectedTileBy)) return;
    S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
    clearTileSelection();
  } else {
    return;
  }
  updateCounter();
  markDirty();
  draw();
}

function onKeyDown(e: KeyboardEvent) {
  if (isTypingName(e)) return;
  if (e.code === 'Space' && !S.spaceHeld) {
    e.preventDefault();
    S.spaceHeld = true;
    S.canvas!.style.cursor = 'grab';
  }
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
}

function onKeyUp(e: KeyboardEvent) {
  if (isTypingName(e)) return;
  if (e.code === 'Space') {
    S.spaceHeld = false;
    S.canvas!.style.cursor = 'crosshair';
  }
}

let canvasDrawPending = false;

function redrawCanvasOnScroll() {
  if (canvasDrawPending) return;
  canvasDrawPending = true;
  requestAnimationFrame(() => {
    draw();
    canvasDrawPending = false;
  });
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.shiftKey) {
    S.canvasWrap!.scrollLeft += e.deltaY;
  } else {
    S.canvasWrap!.scrollLeft += e.deltaX;
    S.canvasWrap!.scrollTop += e.deltaY;
  }
  redrawCanvasOnScroll();
}

function onThumbstripWheel(e: WheelEvent) {
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  S.thumbstrip!.scrollLeft += d;
}

let ghostEvent: MouseEvent | null = null;
let ghostQueued = false;

function onDocMouseMove(e: MouseEvent) {
  ghostEvent = e;
  if (ghostQueued) return;
  ghostQueued = true;
  requestAnimationFrame(() => {
    ghostQueued = false;
    const ev = ghostEvent;
    ghostEvent = null;
    if (ev) updateGhost(ev);
  });
}

function placementError(def: ObjectDef, x: number, y: number): string | null {
  if ((def.id === SONIC_TYPE || def.id === GOAL_TYPE) && S.objects.some(o => o.type === def.id)) {
    return `Your level already has ${def.id === SONIC_TYPE ? 'Sonic' : 'a Sign Post'}. Only one is allowed per level.`;
  }
  const total = totalObjects(), tiles = countPlacedTiles();
  if (total >= tiles) {
    return `The level is full. There are ${total} objects for ${tiles} placed tiles. Paint more tiles to place more objects.`;
  }
  return tileCrowdedReason(def.id, def.sub ?? 0, x, y);
}

function dropObject(def: ObjectDef, px: number, py: number) {
  const x = snap8(px), y = snap8(py);
  const error = placementError(def, x, y);
  if (error) {
    rejectWithPopup(error, showPlaceError);
    return;
  }
  S.objects.push({ x, y, variant: def.variant ?? 0, type: def.id, sub: def.sub ?? 0 });
  S.selectedObjIdx = S.objects.length - 1;
}

// The tray shares the canvas's x-range, so only count releases on the canvas.
function onDocMouseUp(e: MouseEvent) {
  hideGhost();
  if (!S.paletteDrag) return;
  const { bx, by, px, py } = canvasToWorld(e);
  if (realTarget(e) === S.canvas && inGrid(bx, by)) {
    if (S.activeTab === 'tiles') S.grid[by][bx] = S.paletteDragTile;
    else if (S.paletteDragDef) dropObject(S.paletteDragDef, px, py);
    updateCounter();
    markDirty();
  }
  S.paletteDrag = false;
  S.paletteDragDef = null;
  draw();
}

const ACTIONS: Record<string, () => void> = {
  save: () => { doSave(); },
  test: () => { doTest(); },
  stoptest: stopTest,
  fullscreen: doFullscreen,
  mylevels: () => { location.href = '/editors/mylevels'; },
  alllevels: () => { location.href = '/editors/alllevels'; },
  share: () => { doShare(); },
  saveok: hidePopup,
};

function wireButtons() {
  for (const b of queryAll('[data-zoom]')) {
    b.addEventListener('click', () => setZoom(parseFloat(b.getAttribute('data-zoom') || '1')));
  }
  for (const b of queryAll('.tab')) {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab') as TabType));
  }
  for (const b of queryAll('[data-action]')) {
    const action = ACTIONS[b.getAttribute('data-action') ?? ''];
    if (action) b.addEventListener('click', action);
  }
  query('.btn-clear')?.addEventListener('click', doClearAll);
}

function wireCanvas(canvas: HTMLCanvasElement) {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

// the new size is only measurable after layout settles
function wireResizing() {
  window.addEventListener('resize', resizeCanvas);
  const resizeAfterFullscreen = () => {
    requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
  };
  document.addEventListener('fullscreenchange', resizeAfterFullscreen);
  document.addEventListener('webkitfullscreenchange', resizeAfterFullscreen);
}

export function wireEvents() {
  const { canvas, canvasWrap, thumbstrip } = S;
  wireCanvas(canvas!);
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  wireButtons();
  wireResizing();
  canvasWrap?.addEventListener('scroll', redrawCanvasOnScroll);
  thumbstrip?.addEventListener('wheel', onThumbstripWheel, { passive: false });
}
