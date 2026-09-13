// ts/events.ts — All DOM event handlers

import { MAX_OBJECTS_PER_TILE, snap8, pixelToTile } from './format';
import {
  S, inGrid, canvasToWorld, objectsInTile, findDef, totalObjects, countPlacedTiles, setStatus,
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

  // Right-click erase (any tab): top object first, otherwise the tile itself.
  // This also guarantees no orphaned floating objects: a tile is only cleared
  // once its objects are gone.
  if (e.button === 2) {
    let removedObject = false;
    for (let i = S.objects.length - 1; i >= 0; i--) {
      const o = S.objects[i];
      if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
        S.objects.splice(i, 1);
        removedObject = true;
        break;
      }
    }
    if (!removedObject) {
      S.grid[by][bx] = 0;
    }
    S.selectedObjIdx = -1;
    S.dragObj = null;
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
      setStatus(`Selected: ${findDefName(o.type, o.variant, o.sub)} at (${o.x},${o.y})`);
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

// ── Redraw after scroll (wheel/pan/scrollbar) ──
// The canvas is full-grid sized with viewport culling in draw(); scrolling
// reveals previously-culled (blank) regions, so redraw on scroll. Throttled
// via requestAnimationFrame to avoid re-entrant calls during fast scroll.
let canvasDrawPending = false;

function redrawCanvasOnScroll() {
  if (canvasDrawPending) return;
  canvasDrawPending = true;
  requestAnimationFrame(() => {
    draw();
    canvasDrawPending = false;
  });
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
  redrawCanvasOnScroll();
}

// ── Wheel (scroll tray horizontally via vertical scroll) ──

function onThumbstripWheel(e: WheelEvent) {
  e.preventDefault();
  // Support both mouse-wheel (deltaY) and touchpad swipe (deltaX): the tray
  // is overflow-x only, so forward whichever delta is dominant.
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  S.thumbstrip!.scrollLeft += d;
}

// ── Document-level: palette drag ──

function onDocMouseMove(e: MouseEvent) {
  updateGhost(e);
}

function onDocMouseUp(e: MouseEvent) {
  hideGhost();
  if (!S.paletteDrag) return;

  // Fresh coords from the release event (hover state can be stale if the
  // user wheel-scrolled without moving the mouse).
  const { bx, by, px, py } = canvasToWorld(e);
  if (inGrid(bx, by)) {
    if (S.activeTab === 'tiles') {
      S.grid[by][bx] = S.paletteDragTile;
      setStatus(`Placed block ${S.paletteDragTile} at (${bx},${by})`);
    } else if (S.paletteDragDef) {
      const def = S.paletteDragDef;
      if ((def.id === 151 || def.id === 44) && S.objects.some(o => o.type === def.id)) {
        setStatus(`Only one ${def.name} per level!`);
      } else if (totalObjects() >= countPlacedTiles()) {
        setStatus('Max object limit reached!');
      } else if (objectsInTile(bx, by) >= MAX_OBJECTS_PER_TILE) {
        setStatus(`Max ${MAX_OBJECTS_PER_TILE} objects per tile!`);
      } else {
        // Free pixel placement (8px snap), like the stock levels use.
        // Objects live in AIR (or straddling ground) — the per-tile count
        // is a budget, not a solidity requirement. Warn if buried solid.
        const ox = snap8(px), oy = snap8(py);
        S.objects.push({ x: ox, y: oy, variant: def.variant ?? 0, type: def.id, sub: def.sub ?? 0 });
        const buried = S.grid[by][bx] !== 0;
        setStatus(`Placed ${def.name} at (${ox},${oy})` + (buried ? ' — inside solid tile!' : ''));
      }
    }
    updateCounter();
  }

  S.paletteDrag = false;
  S.paletteDragDef = null;
  draw();
}

// ── Helpers ──

function findDefName(typeId: number, variant = 0, sub = 0): string {
  const def = findDef(typeId, variant, sub);
  return def ? def.name : `${typeId}`;
}

// ── Wire everything up ──

export function wireEvents() {
  const { canvas, canvasWrap, shadow, thumbstrip } = S;

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

  // Canvas: redraw after any scroll (wheel, pan, or scrollbar drag) so
  // newly-revealed viewport regions get painted — not just on next mouse move.
  canvasWrap?.addEventListener('scroll', redrawCanvasOnScroll);

  // Thumbstrip: vertical wheel → horizontal scroll (tray is overflow-x only)
  thumbstrip?.addEventListener('wheel', onThumbstripWheel, { passive: false });
}
