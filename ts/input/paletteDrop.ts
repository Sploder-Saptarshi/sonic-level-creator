// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Dragging tiles and objects from the tray onto the grid.

import { snap8, type ObjectDef } from '../level/format';
import { S, inGrid, canvasToWorld } from '../core/state';
import { draw, updateGhost, hideGhost } from '../render/render';
import { updateCounter } from '../ui/thumbnails';
import { realTarget } from '../core/dom';
import { showPlaceError } from '../ui/popup';
import { markDirty } from '../playtest/testMode';
import { placementError, rejectWithPopup } from '../level/rules';

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

export function wirePaletteDrop() {
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);
}
