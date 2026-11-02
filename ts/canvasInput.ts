// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { snap8, pixelToTile } from './format';
import {
  S, inGrid, canvasToWorld, cellSize, clearSelection, clearTileSelection,
} from './state';
import { draw, requestDraw, ensureGlowLoop, hitTileBadge, objectHitIndex } from './render';
import { updateCounter } from './thumbnails';
import { realTarget } from './dom';
import { showPlaceError } from './popup';
import { markDirty } from './testMode';
import { rejectTileClear, rejectWithPopup, tileCrowdedReason } from './rules';

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

export function wireCanvasInput(canvas: HTMLCanvasElement, canvasWrap: HTMLElement) {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvasWrap.addEventListener('scroll', redrawCanvasOnScroll);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}
