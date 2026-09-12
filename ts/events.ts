// ts/events.ts — All DOM event handlers

import { BLOCK_PX, MAX_OBJECTS_PER_TILE, snap8, pixelToTile } from './format';
import {
  S, cellSize, inGrid, canvasToWorld, objectsInTile, findDef, resetInteraction, setStatus,
} from './state';
import { draw, updateGhost, hideGhost } from './render';
import { updateCounter } from './thumbnails';
import { doSave, doTest, doFullscreen, doClearAll, setZoom, resizeCanvas } from './actions';
import { buildThumbnails, switchTab } from './thumbnails';

// ── Canvas: mousedown ──

function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  const { bx, by, px, py } = canvasToWorld(e);

  // Pan: space held or middle-click
  if (S.spaceHeld || e.button === 1) {
    S.panning = true;
    S.panStartX = e.clientX;
    S.panStartY = e.clientY;
    S.panStartSX = S.canvasWrap!.scrollLeft;
    S.panStartSY = S.canvasWrap!.scrollTop;
    S.canvas!.style.cursor = 'grabbing';
    return;
  }

  if (!inGrid(bx, by)) return;

  // Right-click erase
  if (e.button === 2) {
    if (S.activeTab === 'tiles') {
      S.grid[by][bx] = 0;
    } else {
      for (let i = S.objects.length - 1; i >= 0; i--) {
        const o = S.objects[i];
        if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
          S.objects.splice(i, 1);
          break;
        }
      }
      S.selectedObjIdx = -1;
      S.dragObj = null;
    }
    updateCounter();
    draw();
    return;
  }

  // Object: select/drag existing
  if (S.activeTab !== 'tiles') {
    let found = -1;
    for (let i = S.objects.length - 1; i >= 0; i--) {
      const o = S.objects[i];
      if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
        found = i;
        break;
      }
    }
    S.selectedObjIdx = found;
    if (found >= 0) {
      const o = S.objects[found];
      S.dragObj = o;
      S.dragOffX = px - o.x;
      S.dragOffY = py - o.y;
      setStatus(`Selected: ${findDefName(o.type)} at (${o.x},${o.y})`);
    } else {
      S.dragObj = null;
      setStatus('');
    }
    updateCounter();
    draw();
  }
}

// ── Canvas: mousemove ──

function onMouseMove(e: MouseEvent) {
  if (S.panning) {
    S.canvasWrap!.scrollLeft = S.panStartSX - (e.clientX - S.panStartX);
    S.canvasWrap!.scrollTop = S.panStartSY - (e.clientY - S.panStartY);
    draw();
    return;
  }

  const { bx, by, px, py } = canvasToWorld(e);

  // Drag existing object on canvas
  if (S.dragObj && S.selectedObjIdx >= 0) {
    S.dragObj.x = snap8(px - S.dragOffX);
    S.dragObj.y = snap8(py - S.dragOffY);
    updateCounter();
  }

  draw();
}

// ── Canvas: mouseup ──

function onMouseUp(_e: MouseEvent) {
  S.panning = false;
  S.dragObj = null;
  S.canvas!.style.cursor = S.spaceHeld ? 'grab' : 'crosshair';
  draw();
}

// ── Canvas: mouseleave ──

function onMouseLeave() {
  S.panning = false;
  S.dragObj = null;
  S.canvas!.style.cursor = S.spaceHeld ? 'grab' : 'crosshair';
  draw();
}

// ── Canvas: context menu ──

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
}

// ── Keyboard ──

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !S.spaceHeld) {
    e.preventDefault();
    S.spaceHeld = true;
    S.canvas!.style.cursor = 'grab';
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.selectedObjIdx >= 0) {
    S.objects.splice(S.selectedObjIdx, 1);
    S.selectedObjIdx = -1;
    setStatus('Deleted');
    updateCounter();
    draw();
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    S.spaceHeld = false;
    S.canvas!.style.cursor = 'crosshair';
  }
}

// ── Wheel (scroll canvas) ──

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.shiftKey) {
    S.canvasWrap!.scrollLeft += e.deltaY;
  } else {
    S.canvasWrap!.scrollLeft += e.deltaX;
    S.canvasWrap!.scrollTop += e.deltaY;
  }
}

// ── Document-level: palette drag ──

function onDocMouseMove(e: MouseEvent) {
  updateGhost(e);
  if (!S.paletteDrag) return;

  const { bx, by } = canvasToWorld(e);
  if (inGrid(bx, by)) {
    S.hoverBx = bx;
    S.hoverBy = by;
    S.mouseOverCanvas = true;
  } else {
    S.hoverBx = -1;
    S.hoverBy = -1;
    S.mouseOverCanvas = false;
  }
  draw();
}

function onDocMouseUp(_e: MouseEvent) {
  hideGhost();
  if (!S.paletteDrag) return;

  if (S.mouseOverCanvas && S.hoverBx >= 0 && S.hoverBy >= 0) {
    if (S.activeTab === 'tiles') {
      S.grid[S.hoverBy][S.hoverBx] = S.paletteDragTile;
      setStatus(`Placed block ${S.paletteDragTile} at (${S.hoverBx},${S.hoverBy})`);
    } else if (S.paletteDragDef) {
      if (S.grid[S.hoverBy][S.hoverBx] === 0) {
        setStatus('Objects must be placed on a tile!');
      } else if (objectsInTile(S.hoverBx, S.hoverBy) >= MAX_OBJECTS_PER_TILE) {
        setStatus(`Max ${MAX_OBJECTS_PER_TILE} objects per tile!`);
      } else {
        const px = S.hoverBx * BLOCK_PX;
        const py = S.hoverBy * BLOCK_PX;
        S.objects.push({ x: snap8(px), y: snap8(py), variant: 0, type: S.paletteDragDef.id, sub: 0 });
        setStatus(`Placed ${S.paletteDragDef.name} at (${S.hoverBx},${S.hoverBy})`);
      }
    }
    updateCounter();
  }

  S.paletteDrag = false;
  S.paletteDragDef = null;
  S.hoverBx = -1;
  S.hoverBy = -1;
  S.mouseOverCanvas = false;
  draw();
}

// ── Helpers ──

function findDefName(typeId: number): string {
  const def = findDef(typeId);
  return def ? def.name : `${typeId}`;
}

// ── Wire everything up ──

export function wireEvents() {
  const { canvas, canvasWrap, shadow } = S;

  // Canvas events
  canvas!.addEventListener('mousedown', onMouseDown);
  canvas!.addEventListener('mousemove', onMouseMove);
  canvas!.addEventListener('mouseup', onMouseUp);
  canvas!.addEventListener('mouseleave', onMouseLeave);
  canvas!.addEventListener('contextmenu', onContextMenu);
  canvas!.addEventListener('wheel', onWheel, { passive: false });

  // Document-level for palette drag crossing DOM boundaries
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);

  // Keyboard
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Zoom buttons
  shadow!.querySelectorAll('[data-zoom]').forEach(b => {
    b.addEventListener('click', () => setZoom(parseFloat(b.getAttribute('data-zoom') || '1')));
  });

  // Tab buttons
  shadow!.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab') as S['activeTab']));
  });

  // Action buttons
  shadow!.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', () => {
      const a = b.getAttribute('data-action');
      if (a === 'save') doSave();
      else if (a === 'test') doTest();
      else if (a === 'fullscreen') doFullscreen();
      else if (a === 'share') setStatus('SHARE — not wired yet');
      else if (a === 'mylevels') location.href = '/editors/?action=myLevels&gamegroupid=52';
      else if (a === 'alllevels') location.href = '/editors/?action=editorDetail&gamegroupid=52';
    });
  });

  // Clear button
  shadow!.querySelector('.btn-clear')?.addEventListener('click', doClearAll);

  // Window resize
  window.addEventListener('resize', resizeCanvas);
}
