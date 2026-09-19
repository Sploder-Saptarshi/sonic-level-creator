// ts/events.ts — All DOM event handlers

import { MAX_OBJECTS_PER_TILE, objectTileCostInTile, objectTiles, countObjectsInTile, snap8, pixelToTile } from './format';
import {
  S, inGrid, canvasToWorld, totalObjects, countPlacedTiles,
  cellSize, updateDesc,
} from './state';
import { draw, requestDraw, updateGhost, hideGhost, ensureGlowLoop, hitTileBadge, objectHitIndex } from './render';
import { updateCounter } from './thumbnails';
import { doSave, doTest, stopTest, doFullscreen, doClearAll, setZoom, resizeCanvas, markDirty, doStartCreating, doSelectMapSize, doShare, hideSaveOverlay, showPlaceError } from './actions';
import { buildThumbnails, switchTab } from './thumbnails';

// ── Canvas: mousedown ──

function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  const { bx, by, px, py, mx, my } = canvasToWorld(e);

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

  // Remove badge (any tab, left-click): clicking the X on a selected tile
  // clears the tile. Checked before the grid bounds so a badge hanging off
  // the grid edge still works.
  if (e.button === 0 && hitTileBadge(mx, my, cellSize())) {
    S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
    S.selectedTileBx = -1;
    S.selectedTileBy = -1;
    S.selectedObjIdx = -1;
    S.dragObj = null;
    updateCounter();
    draw();
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
    if (S.selectedTileBx === bx && S.selectedTileBy === by) {
      S.selectedTileBx = -1;
      S.selectedTileBy = -1;
    }
    updateCounter();
    markDirty();
    draw();
    return;
  }

  // Tiles tab: left-click selects the filled cell (empty cell deselects) —
  // unless the click lands on actual sprite art, which selects the object.
  // Skipped mid palette-drag so a drop never double-selects.
  if (S.activeTab === 'tiles' && e.button === 0 && !S.paletteDrag) {
    const hit = objectHitIndex(mx, my);
    if (hit >= 0) {
      S.selectedObjIdx = hit;
      const o = S.objects[hit];
      S.dragObj = o;
      S.dragOffX = px - o.x;
      S.dragOffY = py - o.y;
      S.dragStartX = o.x;
      S.dragStartY = o.y;
      S.selectedTileBx = -1;
      S.selectedTileBy = -1;
    } else if (S.grid[by][bx] > 0) {
      S.selectedTileBx = bx;
      S.selectedTileBy = by;
      S.selectedObjIdx = -1;
      S.dragObj = null;
    } else {
      S.selectedTileBx = -1;
      S.selectedTileBy = -1;
      S.selectedObjIdx = -1;
      S.dragObj = null;
    }
    updateCounter();
    draw();
    return;
  }

  // Object: select/drag existing. Precise sprite hit — a click on bare tile
  // art (even in a cell containing an object) selects the tile instead.
  if (S.activeTab !== 'tiles') {
    const found = objectHitIndex(mx, my);
    S.selectedObjIdx = found;
    if (found >= 0) {
      const o = S.objects[found];
      S.dragObj = o;
      S.dragOffX = px - o.x;
      S.dragOffY = py - o.y;
      S.dragStartX = o.x;
      S.dragStartY = o.y;
      S.selectedTileBx = -1;
      S.selectedTileBy = -1;
    } else {
      S.dragObj = null;
      // No sprite here but a tile: select the tile instead.
      if (S.grid[by][bx] > 0) {
        S.selectedTileBx = bx;
        S.selectedTileBy = by;
      } else {
        S.selectedTileBx = -1;
        S.selectedTileBy = -1;
      }
    }
    updateCounter();
    draw();
  }
}

// ── Canvas: mousemove ──

function onMouseMove(e: MouseEvent) {
  const { bx, by, px, py, mx, my } = canvasToWorld(e);

  // Hover highlight: track the cell under the cursor (-1 when outside grid)
  const hbx = inGrid(bx, by) ? bx : -1;
  const hby = inGrid(bx, by) ? by : -1;
  S.hoverBx = hbx;
  S.hoverBy = hby;

  if (S.panning) {
    S.canvasWrap!.scrollLeft = S.panStartSX - (e.clientX - S.panStartX);
    S.canvasWrap!.scrollTop = S.panStartSY - (e.clientY - S.panStartY);
    requestDraw();
    return;
  }

  // Pointer cursor over the tile remove badge, crosshair otherwise.
  S.canvas!.style.cursor = S.spaceHeld ? 'grab'
    : hitTileBadge(mx, my, cellSize()) ? 'pointer' : 'crosshair';

  // Drag existing object on canvas
  if (S.dragObj && S.selectedObjIdx >= 0) {
    S.dragObj.x = snap8(px - S.dragOffX);
    S.dragObj.y = snap8(py - S.dragOffY);
    updateCounter();
  }

  // Palette-drag drop preview: keep the snapped canvas preview in sync even
  // for canvas-originated moves (the document handler re-syncs + draws again,
  // setting identical values, so this stays idempotent).
  if (S.paletteDrag) {
    S.previewOnCanvas = inGrid(bx, by);
    S.previewPX = snap8(px);
    S.previewPY = snap8(py);
  }

  // Paint coalesced to one frame (see requestDraw): mousemove storms must
  // not synchronously repaint the full grid each.
  requestDraw();
  ensureGlowLoop();
}

// ── Canvas: mouseup ──

// Moving an existing object must respect the per-tile cap too: every tile
// the object touches at its new position (anchor plus any ring spill) is
// checked, and an overfull move is reverted with an overlay explaining why.
function finishObjectDrag() {
  const o = S.dragObj;
  if (!o || S.selectedObjIdx < 0) return;
  let crowded: string | null = null;
  for (const t of objectTiles(o.type, o.sub, o.x, o.y)) {
    const others = countObjectsInTile(S.objects, t.tc, t.tr, o);
    const added = objectTileCostInTile(o.type, o.sub, o.x, o.y, t.tc, t.tr);
    if (others + added > MAX_OBJECTS_PER_TILE) {
      crowded = added > 1
        ? `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects and this ring bunch needs room for ${added}. Try a tile with more room.`
        : `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects. Try a tile with more room.`;
      break;
    }
  }
  if (crowded) {
    o.x = S.dragStartX;
    o.y = S.dragStartY;
    updateDesc(crowded);
    showPlaceError(crowded);
  }
}

function onMouseUp(_e: MouseEvent) {
  S.panning = false;
  finishObjectDrag();
  S.dragObj = null;
  S.canvas!.style.cursor = S.spaceHeld ? 'grab' : 'crosshair';
  draw();
}

// ── Canvas: mouseleave ──

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

// ── Canvas: context menu ──

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
}

// ── Keyboard ──

function keyTarget(e: KeyboardEvent): HTMLElement | null {
  // Document-level listeners see shadow-retargeted targets (the host), so
  // read the real target from composedPath() like the mouse handlers do.
  const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
  const t = (path && path[0]) || e.target;
  return (t instanceof HTMLElement) ? t : null;
}

function onKeyDown(e: KeyboardEvent) {
  // Typing in the start-screen name field must not drive the editor.
  if (keyTarget(e)?.classList?.contains('start-name')) return;
  if (e.code === 'Space' && !S.spaceHeld) {
    e.preventDefault();
    S.spaceHeld = true;
    S.canvas!.style.cursor = 'grab';
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.selectedObjIdx >= 0) {
      S.objects.splice(S.selectedObjIdx, 1);
      S.selectedObjIdx = -1;
      updateCounter();
      markDirty();
      draw();
    } else if (S.selectedTileBx >= 0 && S.selectedTileBy >= 0
      && S.selectedTileBy < S.grid.length && S.selectedTileBx < S.grid[0].length) {
      S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
      S.selectedTileBx = -1;
      S.selectedTileBy = -1;
      updateCounter();
      markDirty();
      draw();
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (keyTarget(e)?.classList?.contains('start-name')) return;
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
// Ghost updates coalesced to one per frame: raw mousemove storms (100+/s)
// must not each touch the DOM. Preview sync for draw() rides along (≤1
// frame stale); drop cleanup on mouseup stays synchronous.

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

function onDocMouseUp(e: MouseEvent) {
  hideGhost();
  if (!S.paletteDrag) return;

  // A drop only counts when released over the canvas element itself. The
  // tray sits in the same x-range, so a tray release would otherwise map to
  // canvas coords and place under the tray. NOTE: this listener lives on
  // `document`, outside the editor shadow root, so e.target is retargeted
  // to the shadow host — read the real target from composedPath() instead.
  // (The carry ghost is pointer-events:none, so it never becomes a target.)
  const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
  const releasedOnCanvas = (path && path.length > 0 ? path[0] : e.target) === S.canvas;

  // Fresh coords from the release event (hover state can be stale if the
  // user wheel-scrolled without moving the mouse).
  const { bx, by, px, py } = canvasToWorld(e);
  if (releasedOnCanvas && inGrid(bx, by)) {
    if (S.activeTab === 'tiles') {
      S.grid[by][bx] = S.paletteDragTile;
    } else if (S.paletteDragDef) {
      const def = S.paletteDragDef;
      const sub = def.sub ?? 0;
      if ((def.id === 151 || def.id === 44) && S.objects.some(o => o.type === def.id)) {
        // Only one Sonic/Sign Post per level.
        const already = `Your level already has ${def.id === 151 ? 'Sonic' : 'a Sign Post'}. Only one is allowed per level.`;
        updateDesc(already);
        showPlaceError(already);
      } else if (totalObjects() >= countPlacedTiles()) {
        // Global object budget: each placed tile supports one object.
        const total = totalObjects(), tiles = countPlacedTiles();
        const full = `The level is full. There are ${total} objects for ${tiles} placed tiles. Paint more tiles to place more objects.`;
        updateDesc(full);
        showPlaceError(full);
      } else {
        // Per-tile cap: each live ring counts toward the tile it lands in,
        // so a bunch straddling a boundary is checked against every tile it
        // touches (it still costs 1 globally).
        const ox = snap8(px), oy = snap8(py);
        let crowded: string | null = null;
        for (const t of objectTiles(def.id, sub, ox, oy)) {
          const existing = countObjectsInTile(S.objects, t.tc, t.tr);
          const added = objectTileCostInTile(def.id, sub, ox, oy, t.tc, t.tr);
          if (existing + added > MAX_OBJECTS_PER_TILE) {
            crowded = added > 1
              ? `This tile is full. It already holds ${existing} of ${MAX_OBJECTS_PER_TILE} objects and this ring bunch needs room for ${added}. Try a tile with more room.`
              : `This tile is full. It already holds ${existing} of ${MAX_OBJECTS_PER_TILE} objects. Try a tile with more room.`;
            break;
          }
        }
        if (crowded) {
          updateDesc(crowded);
          showPlaceError(crowded);
        } else {
          // Free pixel placement (8px snap), like the stock levels use.
          // Objects live in AIR (or straddling ground) — the per-tile count
          // is a budget, not a solidity requirement.
          S.objects.push({ x: ox, y: oy, variant: def.variant ?? 0, type: def.id, sub });
          // Auto-select the new object so its selection ghosts (travel
          // extremes + red box) show immediately at the placed spot.
          S.selectedObjIdx = S.objects.length - 1;
        }
      }
    }
    updateCounter();
    markDirty();
  }

  S.paletteDrag = false;
  S.paletteDragDef = null;
  draw();
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
      else if (a === 'stoptest') stopTest();
      else if (a === 'fullscreen') doFullscreen();
      else if (a === 'mylevels') location.href = '/editors/mylevels';
      else if (a === 'alllevels') location.href = '/editors/alllevels';
      else if (a === 'share') doShare();
      else if (a === 'startcreating') doStartCreating();
      else if (a === 'saveok') hideSaveOverlay();
    });
  });

  // Start screen: the button stays greyed out until a name is typed;
  // Enter submits only when valid.
  const nameInput = shadow!.querySelector('.start-name') as HTMLInputElement | null;
  const startBtn = shadow!.querySelector('.start-go') as HTMLButtonElement | null;
  nameInput?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') doStartCreating();
  });
  nameInput?.addEventListener('input', () => {
    if (startBtn) startBtn.disabled = !nameInput.value.trim();
  });

  // Map-size step: hovering a region previews its name/dims + glows it.
  // One mouseover listener on the area (not per-region mouseenter, which
  // never re-fires when moving outward Small -> Medium -> Large). closest()
  // resolves the innermost region under the cursor in both directions.
  const mapArea = shadow!.querySelector('.map-area');
  const mapLabel = shadow!.querySelector('.map-label');
  mapArea?.addEventListener('mouseover', (e) => {
    const t = (e.target as Element).closest?.('.map-opt');
    if (!t || !mapArea.contains(t)) return;
    shadow!.querySelectorAll('.map-opt.map-hover').forEach((o) => {
      if (o !== t) o.classList.remove('map-hover');
    });
    t.classList.add('map-hover');
    const n = mapLabel?.querySelector('.map-name');
    const d = mapLabel?.querySelector('.map-dims');
    if (n) n.textContent = t.getAttribute('data-name') ?? '';
    if (d) d.textContent = `${t.getAttribute('data-cols')} x ${t.getAttribute('data-rows')} tiles`;
  });
  shadow!.querySelectorAll('.map-opt').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); doSelectMapSize(b); });
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
