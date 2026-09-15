// ts/render.ts — Canvas drawing + ghost preview

import { BLOCK_PX, TOTAL_BLOCKS, snap8, blockSheetXY } from './format';
import { S, cellSize, findDef, inGrid, canvasToWorld } from './state';
import { partsFor, spriteBBox, drawParts, spriteScale, spriteThumbURL, isMirrored, paintThumb, moveExtremes } from './sprites';

const GHOST_PX = 256;
let ghostCanvas: HTMLCanvasElement;
let ghostCtx: CanvasRenderingContext2D;

// 1x bbox-fitted thumb cache: the canvas blits the exact same paintThumb
// output the tray shows, so tray and canvas can never diverge.
const thumbCache = new Map<string, HTMLCanvasElement>();

function thumbFor(type: number, sub: number, variant: number, mirror: boolean): HTMLCanvasElement | null {
  const key = `${type}:${sub}:${variant}:${mirror ? 1 : 0}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const parts = partsFor(type, sub, variant);
  if (!parts) return null;
  const cvs = document.createElement('canvas');
  if (!paintThumb(cvs.getContext('2d')!, parts, 1, mirror)) return null;
  thumbCache.set(key, cvs);
  return cvs;
}

// White-filled silhouette of the platform core (badge-free) at 1x, for the
// two-direction mover extreme ghosts. Same bbox-fit as thumbFor so canvas
// and extremes share exact pixels; tinted fully white via source-in.
const whiteThumbCache = new Map<string, { cvs: HTMLCanvasElement; bb: { x: number; y: number; w: number; h: number } }>();

function whiteThumbFor(type: number, sub: number, variant: number, mirror: boolean) {
  const key = `${type}:${sub}:${variant}:${mirror ? 1 : 0}`;
  const hit = whiteThumbCache.get(key);
  if (hit) return hit;
  const parts = partsFor(type, sub, variant);
  if (!parts) return null;
  const core = parts.filter(p => !p.badge);
  if (!core.length) return null;
  const src = document.createElement('canvas');
  if (!paintThumb(src.getContext('2d')!, core, 1, mirror)) return null;
  const cvs = document.createElement('canvas');
  cvs.width = src.width;
  cvs.height = src.height;
  const c = cvs.getContext('2d')!;
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, cvs.width, cvs.height);
  const bb = spriteBBox(core);
  const out = { cvs, bb };
  whiteThumbCache.set(key, out);
  return out;
}

export function initGhostCanvas() {
  ghostCanvas = document.createElement('canvas');
  ghostCanvas.width = GHOST_PX;
  ghostCanvas.height = GHOST_PX;
  ghostCtx = ghostCanvas.getContext('2d')!;
}

// ── Main draw ──

export function draw() {
  const { ctx, canvas: cvs, canvasWrap, grid, objects, spritesheetImg } = S;
  if (!ctx || !cvs || !canvasWrap) return;

  const W = cvs.width, H = cvs.height, cs = cellSize();
  // NOTE: the canvas is full-grid sized and natively scrolled by the browser
  // via overflow:auto, so all drawing uses absolute canvas coords (no scroll offset).
  // Scroll is only used for viewport culling.
  const scrollX = canvasWrap.scrollLeft, scrollY = canvasWrap.scrollTop;
  const viewW = canvasWrap.clientWidth || W, viewH = canvasWrap.clientHeight || H;

  ctx.fillStyle = '#f4f9f4';
  ctx.fillRect(0, 0, W, H);

  const c0 = Math.max(0, Math.floor(scrollX / cs) - 1);
  const r0 = Math.max(0, Math.floor(scrollY / cs) - 1);
  const c1 = Math.min(grid[0].length, Math.ceil((scrollX + viewW) / cs) + 1);
  const r1 = Math.min(grid.length, Math.ceil((scrollY + viewH) / cs) + 1);

  // gridlines first (under blocks/objects so they don't show through tiles
  // or sprites). 16 sub-divisions per block (one per tile): 15 thin lines
  // inside each block, bold at the boundary. All 1px; opacity hierarchy —
  // faint on the near-white canvas: 35% at block boundaries (max), 18% at
  // every 8th tile, 8% per-tile.
  const tileCs = cs / 16;
  const tc0 = Math.max(0, Math.floor(scrollX / tileCs) - 1);
  const tc1 = Math.min(grid[0].length * 16, Math.ceil((scrollX + viewW) / tileCs) + 1);
  const tr0 = Math.max(0, Math.floor(scrollY / tileCs) - 1);
  const tr1 = Math.min(grid.length * 16, Math.ceil((scrollY + viewH) / tileCs) + 1);
  for (let t = tc0; t <= tc1; t++) {
    const x = Math.round(t * tileCs) + 0.5;
    if (t % 16 === 0) { ctx.strokeStyle = 'rgba(128,128,128,0.35)'; }
    else if (t % 8 === 0) { ctx.strokeStyle = 'rgba(128,128,128,0.18)'; }
    else { ctx.strokeStyle = 'rgba(128,128,128,0.08)'; }
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let t = tr0; t <= tr1; t++) {
    const y = Math.round(t * tileCs) + 0.5;
    if (t % 16 === 0) { ctx.strokeStyle = 'rgba(128,128,128,0.35)'; }
    else if (t % 8 === 0) { ctx.strokeStyle = 'rgba(128,128,128,0.18)'; }
    else { ctx.strokeStyle = 'rgba(128,128,128,0.08)'; }
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // blocks
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const id = grid[r][c];
      const dx = c * cs, dy = r * cs;
      if (id > 0 && id < TOTAL_BLOCKS && spritesheetImg?.complete) {
        const { x: sx, y: sy } = blockSheetXY(id);
        try { ctx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, dx, dy, cs, cs); }
        catch (_) { ctx.fillStyle = '#aabbcc'; ctx.fillRect(dx, dy, cs, cs); }
      } else if (id > 0) {
        ctx.fillStyle = '#aabbcc';
        ctx.fillRect(dx, dy, cs, cs);
      }
    }
  }

  // objects: true sprites where the game has art, placeholder markers where
  // the game itself draws nothing (no GH art / no draw routine for the type)
  const k = spriteScale(cs);
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const isSel = i === S.selectedObjIdx;
    const parts = partsFor(obj.type, obj.sub, obj.variant);
    if (parts) {
      const mirror = isMirrored(obj.type, obj.variant, obj.sub);
      const bb = spriteBBox(parts);
      const bx0 = (obj.x + bb.x) * k, by0 = (obj.y + bb.y) * k;
      const bw = bb.w * k, bh = bb.h * k;
      if (bx0 + bw < scrollX || bx0 > scrollX + viewW || by0 + bh < scrollY || by0 > scrollY + viewH) continue;
      // Blit the tray-identical 1x thumb (same paintThumb output, same bbox).
      // Falls back to direct draw while images are still loading.
      const t = thumbFor(obj.type, obj.sub, obj.variant, mirror);
      ctx.imageSmoothingEnabled = false;
      if (t) ctx.drawImage(t, 0, 0, t.width, t.height, bx0, by0, bw, bh);
      else drawParts(ctx, parts, obj.x, obj.y, k, mirror);
      if (isSel) {
        // Two-direction movers (two triangles): white-filled ghosts at both
        // travel extremes (shima_nflag_move amplitudes via moveExtremes).
        const extremes = moveExtremes(obj.type, obj.sub);
        if (extremes.length) {
          const wt = whiteThumbFor(obj.type, obj.sub, obj.variant, mirror);
          if (wt) {
            ctx.imageSmoothingEnabled = false;
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.5;
            for (const ex of extremes) {
              const ex0 = (obj.x + ex.dx + wt.bb.x) * k;
              const ey0 = (obj.y + ex.dy + wt.bb.y) * k;
              const ew = wt.bb.w * k, eh = wt.bb.h * k;
              if (ex0 + ew < scrollX || ex0 > scrollX + viewW || ey0 + eh < scrollY || ey0 > scrollY + viewH) continue;
              ctx.drawImage(wt.cvs, 0, 0, wt.cvs.width, wt.cvs.height, ex0, ey0, ew, eh);
            }
            ctx.globalAlpha = prevAlpha;
          }
        }
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(bx0 - 3, by0 - 3, bw + 6, bh + 6);
        ctx.setLineDash([]);
      }
      continue;
    }
    // placeholder: game-invisible type (no art / no draw routine)
    const dx = (obj.x / BLOCK_PX) * cs;
    const dy = (obj.y / BLOCK_PX) * cs;
    const m = Math.max(14, Math.min(48, cs * 0.35));
    if (dx + m < scrollX || dx - m > scrollX + viewW || dy + m < scrollY || dy - m > scrollY + viewH) continue;
    const def = findDef(obj.type);
    ctx.fillStyle = isSel ? 'rgba(255,80,80,0.7)' : 'rgba(160,160,160,0.5)';
    ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
    ctx.strokeStyle = isSel ? '#f00' : '#666';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(dx - m / 2, dy - m / 2, m, m);
    ctx.setLineDash([]);
    if (cs >= 24) {
      ctx.fillStyle = '#000';
      ctx.font = `${Math.max(8, Math.round(m / 3))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def ? def.name.split(' ')[0] : `${obj.type}`, dx, dy);
    }
  }

  // hover glow: glowey.png on top of the hovered cell when it holds a tile.
  // Alpha oscillates 0→1→0 so it fades in and out slowly, over and over.
  const hx = S.hoverBx, hy = S.hoverBy;
  if (hx >= 0 && hy >= 0 && hy < grid.length && hx < grid[0].length
    && grid[hy][hx] > 0 && S.gloweyImg?.complete && S.gloweyImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = glowAlpha();
    try { ctx.drawImage(S.gloweyImg, hx * cs, hy * cs, cs, cs); }
    catch (_) { /* image not ready yet — skip */ }
    ctx.globalAlpha = prevAlpha;
  }

  // Palette-drag drop preview, drawn inside the canvas itself (no HTML
  // duplication). Objects only — tiles keep just the HTML carry ghost.
  // Only live while the cursor is over the grid — updateGhost tracks the
  // snapped world-px drop point into S.previewPX/PY.
  if (S.paletteDrag && S.previewOnCanvas && S.activeTab !== 'tiles') {
    if (S.paletteDragDef) {
      const def = S.paletteDragDef;
      const dsub = def.sub ?? 0, dvar = def.variant ?? 0;
      const dmirror = !!def.mirror || isMirrored(def.id, dvar, dsub);
      const dparts = partsFor(def.id, dsub, dvar);
      const px = S.previewPX, py = S.previewPY;
      if (dparts) {
        const dbb = spriteBBox(dparts);
        const bx0 = (px + dbb.x) * k, by0 = (py + dbb.y) * k;
        const bw = dbb.w * k, bh = dbb.h * k;
        if (!(bx0 + bw < scrollX || bx0 > scrollX + viewW || by0 + bh < scrollY || by0 > scrollY + viewH)) {
          const t = thumbFor(def.id, dsub, dvar, dmirror);
          ctx.imageSmoothingEnabled = false;
          if (t) ctx.drawImage(t, 0, 0, t.width, t.height, bx0, by0, bw, bh);
          else drawParts(ctx, dparts, px, py, k, dmirror);
        }
        // Two-direction movers: white-filled core ghosts at both travel
        // extremes (shima_nflag_move amplitudes via moveExtremes), 50% opacity.
        const extremes = moveExtremes(def.id, dsub);
        if (extremes.length) {
          const wt = whiteThumbFor(def.id, dsub, dvar, dmirror);
          if (wt) {
            ctx.imageSmoothingEnabled = false;
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.5;
            for (const ex of extremes) {
              const ex0 = (px + ex.dx + wt.bb.x) * k;
              const ey0 = (py + ex.dy + wt.bb.y) * k;
              const ew = wt.bb.w * k, eh = wt.bb.h * k;
              if (ex0 + ew < scrollX || ex0 > scrollX + viewW || ey0 + eh < scrollY || ey0 > scrollY + viewH) continue;
              ctx.drawImage(wt.cvs, 0, 0, wt.cvs.width, wt.cvs.height, ex0, ey0, ew, eh);
            }
            ctx.globalAlpha = prevAlpha;
          }
        }
      } else {
        const dx = (px / BLOCK_PX) * cs, dy = (py / BLOCK_PX) * cs;
        const m = Math.max(14, Math.min(48, cs * 0.35));
        if (!(dx + m < scrollX || dx - m > scrollX + viewW || dy + m < scrollY || dy - m > scrollY + viewH)) {
          ctx.fillStyle = 'rgba(255,200,0,0.5)';
          ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
        }
      }
    }
  }

  // Selected tile: 1px 50%-black outline + remove badge, on top of all.
  drawTileSelection(scrollX, scrollY, viewW, viewH, cs);
}

// ── Precise object picking ──

/** Topmost object whose drawn rect contains the canvas-px point, or -1.
 *  Uses the exact same geometry as draw() (bbox-fit, integer scale), so a
 *  click on sprite art selects the object while a click on bare tile art
 *  falls through to tile selection. Transparent padding inside the bbox
 *  still counts as a hit — standard bbox picking. */
export function objectHitIndex(mx: number, my: number): number {
  const { objects, grid } = S;
  if (!grid.length || !grid[0].length) return -1;
  const cs = cellSize();
  const k = spriteScale(cs);
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const parts = partsFor(obj.type, obj.sub, obj.variant);
    if (parts) {
      const bb = spriteBBox(parts);
      const bx0 = (obj.x + bb.x) * k, by0 = (obj.y + bb.y) * k;
      if (mx >= bx0 && mx < bx0 + bb.w * k && my >= by0 && my < by0 + bb.h * k) return i;
    } else {
      // Placeholder marker (game-invisible type): same centered square as draw().
      const dx = (obj.x / BLOCK_PX) * cs, dy = (obj.y / BLOCK_PX) * cs;
      const m = Math.max(14, Math.min(48, cs * 0.35));
      if (mx >= dx - m / 2 && mx < dx + m / 2 && my >= dy - m / 2 && my < dy + m / 2) return i;
    }
  }
  return -1;
}

// ── Tile selection: outline + remove badge ──
// Badge geometry shared by draw() and the events hit-test: a grey-circle /
// white-X badge (same look as the .btn-clear X by the object counter),
// centered on the selected cell's top-right corner.

/** Badge center + radius for a cell, or null when out of grid. */
export function tileBadge(bx: number, by: number, cs: number): { cx: number; cy: number; r: number } | null {
  if (bx < 0 || by < 0 || by >= S.grid.length || bx >= S.grid[0].length) return null;
  const r = Math.max(5, Math.min(10, cs * 0.15));
  return { cx: (bx + 1) * cs, cy: by * cs, r };
}

/** True when the selected tile is still filled (selection is live). */
function selectedTileLive(): boolean {
  const { selectedTileBx: bx, selectedTileBy: by, grid } = S;
  return bx >= 0 && by >= 0 && by < grid.length && bx < grid[0].length && grid[by][bx] > 0;
}

/** True when canvas-px point (mx,my) hits the live selection's badge. */
export function hitTileBadge(mx: number, my: number, cs: number): boolean {
  if (!selectedTileLive()) return false;
  const b = tileBadge(S.selectedTileBx, S.selectedTileBy, cs);
  if (!b) return false;
  const dx = mx - b.cx, dy = my - b.cy;
  const rr = b.r + 2; // small tolerance around the badge
  return dx * dx + dy * dy <= rr * rr;
}

function drawTileSelection(scrollX: number, scrollY: number, viewW: number, viewH: number, cs: number) {
  if (!selectedTileLive()) return;
  const bx = S.selectedTileBx, by = S.selectedTileBy;
  const x0 = bx * cs, y0 = by * cs;
  const b = tileBadge(bx, by, cs)!;
  if (x0 - b.r > scrollX + viewW || x0 + cs + b.r < scrollX
    || y0 - b.r > scrollY + viewH || y0 + cs + b.r < scrollY) return;
  const { ctx } = S;
  if (!ctx) return;
  // 2px fully-opaque black outline.
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(x0, y0, cs, cs);
  // Remove badge: grey disc + white X, top-right corner.
  ctx.fillStyle = '#999999';
  ctx.beginPath();
  ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
  ctx.fill();
  const arm = b.r * 0.45;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, b.r * 0.28);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.cx - arm, b.cy - arm);
  ctx.lineTo(b.cx + arm, b.cy + arm);
  ctx.moveTo(b.cx + arm, b.cy - arm);
  ctx.lineTo(b.cx - arm, b.cy + arm);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
}

// ── Hover-glow pulse ──

const GLOW_PERIOD_MS = 1600; // one full fade in+out cycle

/** 0→1→0 sine pulse: 0 = invisible, 1 = full glow. */
export function glowAlpha(now = performance.now()): number {
  const phase = (now % GLOW_PERIOD_MS) / GLOW_PERIOD_MS; // 0..1
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

/** True while the hovered cell holds a tile (i.e. the glow is visible). */
function hoverGlowActive(): boolean {
  const { grid, hoverBx, hoverBy } = S;
  return hoverBx >= 0 && hoverBy >= 0
    && hoverBy < grid.length && hoverBx < grid[0].length
    && grid[hoverBy][hoverBx] > 0;
}

let glowRaf = 0;

/** Redraw every frame while the glow is visible so the pulse animates.
 *  Self-terminates when the hover leaves or the tile is emptied; safe to
 *  call on every mousemove (only one loop ever runs). */
export function ensureGlowLoop() {
  if (glowRaf || !hoverGlowActive()) return;
  const tick = () => {
    if (!hoverGlowActive()) { glowRaf = 0; return; }
    draw();
    glowRaf = requestAnimationFrame(tick);
  };
  glowRaf = requestAnimationFrame(tick);
}

// ── Ghost preview (follows cursor during palette drag) ──
//
// The single floating HTML ghost (#ghost) is the carry preview and stays
// visible everywhere — including over the grid — so the page always shows an
// HTML preview of the dragged item. Travel extremes are NOT duplicated into
// HTML: they live only in the canvas drop preview in draw(), which paints the
// snapped placement (+ white 50% ghosts) underneath the cursor while over
// the grid.

export function updateGhost(e: MouseEvent) {
  const { ghostEl, spritesheetImg, activeTab } = S;
  if (!ghostEl) return;
  if (!S.paletteDrag) {
    hideGhost();
    return;
  }
  // Track the snapped drop point + whether the cursor is over the grid.
  // canvasToWorld works for out-of-canvas events too (negative/off-grid).
  if (S.canvas) {
    try {
      const { bx, by, px, py } = canvasToWorld(e);
      S.previewOnCanvas = inGrid(bx, by);
      S.previewPX = snap8(px);
      S.previewPY = snap8(py);
    } catch (_) { S.previewOnCanvas = false; }
  } else {
    S.previewOnCanvas = false;
  }
  const cs = cellSize();
  ghostEl.classList.add('visible');
  ghostEl.style.display = '';
  ghostEl.style.width = cs + 'px';
  ghostEl.style.height = cs + 'px';
  ghostEl.style.left = (e.clientX - cs / 2) + 'px';
  ghostEl.style.top = (e.clientY - cs / 2) + 'px';
  if (activeTab === 'tiles' && spritesheetImg?.complete) {
    ghostCtx.clearRect(0, 0, GHOST_PX, GHOST_PX);
    const { x: sx, y: sy } = blockSheetXY(S.paletteDragTile);
    ghostCtx.imageSmoothingEnabled = false;
    ghostCtx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, GHOST_PX, GHOST_PX);
    ghostEl.style.backgroundImage = `url(${ghostCanvas.toDataURL()})`;
    ghostEl.style.backgroundSize = '100% 100%';
    ghostEl.style.display = '';
  } else if (S.paletteDragDef) {
    const def = S.paletteDragDef;
    const dsub = def.sub ?? 0, dvar = def.variant ?? 0;
    const dmirror = !!def.mirror || isMirrored(def.id, dvar, dsub);
    const parts = partsFor(def.id, dsub, dvar);
    const url = spriteThumbURL(def.id, dsub, dvar, dmirror);
    if (url && parts) {
      // True-scale carry preview (bbox-sized); extremes stay canvas-only.
      const k = spriteScale(cs);
      const bb = spriteBBox(parts);
      ghostEl.style.width = Math.max(1, bb.w * k) + 'px';
      ghostEl.style.height = Math.max(1, bb.h * k) + 'px';
      ghostEl.style.left = (e.clientX + bb.x * k) + 'px';
      ghostEl.style.top = (e.clientY + bb.y * k) + 'px';
      ghostEl.style.backgroundImage = `url(${url})`;
      ghostEl.style.backgroundSize = '100% 100%';
      ghostEl.style.backgroundRepeat = 'no-repeat';
      ghostEl.style.backgroundPosition = 'center';
      ghostEl.style.backgroundColor = 'rgba(0,0,0,0.3)';
      ghostEl.style.display = '';
      ghostEl.textContent = '';
    } else {
      ghostEl.style.backgroundImage = 'none';
      ghostEl.style.backgroundColor = 'rgba(255,200,0,0.5)';
      ghostEl.style.display = 'flex';
      ghostEl.style.alignItems = 'center';
      ghostEl.style.justifyContent = 'center';
      ghostEl.style.fontSize = '10px';
      ghostEl.style.color = '#fff';
      ghostEl.style.textAlign = 'center';
      ghostEl.textContent = S.paletteDragDef.name.split(' ')[0];
    }
  } else {
    ghostEl.style.backgroundImage = 'none';
    ghostEl.style.backgroundColor = 'rgba(255,200,0,0.5)';
    ghostEl.style.display = 'flex';
    ghostEl.style.alignItems = 'center';
    ghostEl.style.justifyContent = 'center';
    ghostEl.style.fontSize = '10px';
    ghostEl.style.color = '#fff';
    ghostEl.style.textAlign = 'center';
    ghostEl.textContent = '';
  }
  // Over the grid the canvas paints the snapped object drop preview (+
  // extremes for two-direction movers) underneath the HTML carry ghost.
  // Tiles stay HTML-only, so no canvas redraw for them.
  if (S.previewOnCanvas && S.activeTab !== 'tiles') draw();
}

export function hideGhost() {
  const { ghostEl } = S;
  S.previewOnCanvas = false;
  if (!ghostEl) return;
  ghostEl.classList.remove('visible');
  ghostEl.style.display = '';
}
