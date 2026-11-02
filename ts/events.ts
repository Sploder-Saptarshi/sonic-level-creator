// DOM event handlers for the canvas, palette, keyboard and buttons.

import { MAX_OBJECTS_PER_TILE, objectTileCostInTile, objectTiles, countObjectsInTile, snap8, pixelToTile, type ObjectDef, type PlacedObject } from './format';
import {
  S, inGrid, canvasToWorld, totalObjects, countPlacedTiles,
  cellSize, updateDesc, type TabType,
} from './state';
import { draw, requestDraw, updateGhost, hideGhost, ensureGlowLoop, hitTileBadge, objectHitIndex } from './render';
import { updateCounter, switchTab } from './thumbnails';
import { doSave, doTest, stopTest, doFullscreen, doClearAll, setZoom, resizeCanvas, markDirty, doStartCreating, doSelectMapSize, doShare, hideSaveOverlay, showPlaceError, showDeleteError } from './actions';

const SONIC_TYPE = 151;
const GOAL_TYPE = 44;

// Listeners on `document` see shadow-retargeted targets (the host), so the
// real target comes from composedPath().
function realTarget(e: Event): EventTarget | null {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
  return (path && path.length > 0 ? path[0] : e.target) ?? null;
}

function rejectWithPopup(msg: string, show: (msg: string) => void) {
  updateDesc(msg);
  show(msg);
}

// ── Budgets ──

// Each object needs a placed tile, so a tile can't be cleared when the
// remaining tiles couldn't hold every object.
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

// Checks every tile the object would touch (a ring bunch can spill into a
// neighbour) against the per-tile cap. `except` skips the object being moved.
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

// ── Selection helpers ──

function clearTileSelection() {
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
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

// A click on sprite art selects the object; otherwise a filled cell selects
// the tile, and an empty cell clears the selection.
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

// ── Canvas: mousedown ──

function startPan(e: MouseEvent) {
  S.panning = true;
  S.panStartX = e.clientX;
  S.panStartY = e.clientY;
  S.panStartSX = S.canvasWrap!.scrollLeft;
  S.panStartSY = S.canvasWrap!.scrollTop;
  S.canvas!.style.cursor = 'grabbing';
}

// The X badge on the selected tile clears it.
function clearSelectedTile() {
  if (rejectTileClear(S.selectedTileBx, S.selectedTileBy)) return;
  S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
  clearTileSelection();
  S.selectedObjIdx = -1;
  S.dragObj = null;
  updateCounter();
  draw();
}

// Right-click removes the top object in the cell, or else the tile, so
// objects are never left floating on a cleared tile.
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
  // Checked before the bounds test: the badge can hang off the grid edge.
  if (e.button === 0 && hitTileBadge(mx, my, cellSize())) {
    clearSelectedTile();
    return;
  }
  if (!inGrid(bx, by)) return;
  if (e.button === 2) {
    eraseAt(bx, by);
    return;
  }
  // On the Tiles tab, only plain left-clicks select (never mid palette-drag).
  const canSelect = S.activeTab !== 'tiles' || (e.button === 0 && !S.paletteDrag);
  if (canSelect) selectAt(bx, by, px, py, mx, my);
}

// ── Canvas: mousemove ──

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

  // Keeps the palette-drop preview in sync (the document handler sets the
  // same values, so this is idempotent).
  if (S.paletteDrag) {
    S.previewOnCanvas = inside;
    S.previewPX = snap8(px);
    S.previewPY = snap8(py);
  }

  // Coalesced to one paint per frame.
  requestDraw();
  ensureGlowLoop();
}

// ── Canvas: mouseup / mouseleave ──

// A move that overfills a tile is reverted.
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

// ── Keyboard ──

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

// ── Scrolling ──

// The sticky canvas only paints the visible viewport, so any scroll needs a
// redraw (throttled to one per frame).
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

// The tray only scrolls horizontally, so forward whichever wheel delta
// dominates (mouse wheel or touchpad swipe).
function onThumbstripWheel(e: WheelEvent) {
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  S.thumbstrip!.scrollLeft += d;
}

// ── Palette drag (document level) ──

// Ghost updates are coalesced to one per frame.
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
  // Each placed tile supports one object.
  const total = totalObjects(), tiles = countPlacedTiles();
  if (total >= tiles) {
    return `The level is full. There are ${total} objects for ${tiles} placed tiles. Paint more tiles to place more objects.`;
  }
  return tileCrowdedReason(def.id, def.sub ?? 0, x, y);
}

// Objects snap to 8px anywhere, including mid-air; the per-tile count is a
// budget, not a solidity rule. The new object is selected right away.
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

// Drops only count when released over the canvas itself: the tray shares
// its x-range, so a tray release would otherwise land under the tray.
function onDocMouseUp(e: MouseEvent) {
  hideGhost();
  if (!S.paletteDrag) return;
  // Fresh coords: hover state is stale after a wheel scroll without moving.
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

// ── Wiring ──

const ACTIONS: Record<string, () => void> = {
  save: () => { doSave(); },
  test: () => { doTest(); },
  stoptest: stopTest,
  fullscreen: doFullscreen,
  mylevels: () => { location.href = '/editors/mylevels'; },
  alllevels: () => { location.href = '/editors/alllevels'; },
  share: () => { doShare(); },
  startcreating: doStartCreating,
  saveok: hideSaveOverlay,
};

function wireButtons(shadow: ShadowRoot) {
  shadow.querySelectorAll('[data-zoom]').forEach(b => {
    b.addEventListener('click', () => setZoom(parseFloat(b.getAttribute('data-zoom') || '1')));
  });
  shadow.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab') as TabType));
  });
  shadow.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', () => ACTIONS[b.getAttribute('data-action') ?? '']?.());
  });
  shadow.querySelector('.btn-clear')?.addEventListener('click', doClearAll);
}

// The start button stays disabled until a name is typed; Enter submits.
function wireStartScreen(shadow: ShadowRoot) {
  const nameInput = shadow.querySelector('.start-name') as HTMLInputElement | null;
  const startBtn = shadow.querySelector('.start-go') as HTMLButtonElement | null;
  nameInput?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') doStartCreating();
  });
  nameInput?.addEventListener('input', () => {
    if (startBtn) startBtn.disabled = !nameInput.value.trim();
  });
}

// One mouseover on the whole area (mouseenter wouldn't re-fire when moving
// outward); closest() finds the innermost region under the cursor.
function wireMapSizePicker(shadow: ShadowRoot) {
  const mapArea = shadow.querySelector('.map-area');
  const mapLabel = shadow.querySelector('.map-label');
  mapArea?.addEventListener('mouseover', (e) => {
    const t = (e.target as Element).closest?.('.map-opt');
    if (!t || !mapArea.contains(t)) return;
    shadow.querySelectorAll('.map-opt.map-hover').forEach((o) => {
      if (o !== t) o.classList.remove('map-hover');
    });
    t.classList.add('map-hover');
    const n = mapLabel?.querySelector('.map-name');
    const d = mapLabel?.querySelector('.map-dims');
    if (n) n.textContent = t.getAttribute('data-name') ?? '';
    if (d) d.textContent = `${t.getAttribute('data-cols')} x ${t.getAttribute('data-rows')} tiles`;
  });
  shadow.querySelectorAll('.map-opt').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); doSelectMapSize(b); });
  });
}

function wireCanvas(canvas: HTMLCanvasElement) {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

// The canvas-wrap reports its new size only after layout settles, so the
// resize waits two frames after a fullscreen change.
function wireResizing() {
  window.addEventListener('resize', resizeCanvas);
  const resizeAfterFullscreen = () => {
    requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
  };
  document.addEventListener('fullscreenchange', resizeAfterFullscreen);
  document.addEventListener('webkitfullscreenchange', resizeAfterFullscreen);
}

export function wireEvents() {
  const { canvas, canvasWrap, shadow, thumbstrip } = S;
  wireCanvas(canvas!);
  // Palette drags cross DOM boundaries, so they're tracked on the document.
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  wireButtons(shadow!);
  wireStartScreen(shadow!);
  wireMapSizePicker(shadow!);
  wireResizing();
  canvasWrap?.addEventListener('scroll', redrawCanvasOnScroll);
  thumbstrip?.addEventListener('wheel', onThumbstripWheel, { passive: false });
}
