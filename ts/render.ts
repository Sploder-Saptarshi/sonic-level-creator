// Canvas drawing, object picking and the palette-drag ghost.

import { BLOCK_PX, TOTAL_BLOCKS, snap8, blockSheetXY, type ObjectDef } from './format';
import { S, cellSize, findDef, inGrid, canvasToWorld } from './state';
import { partsFor, spriteBBox, drawParts, spriteScale, spriteThumbURL, isMirrored, paintThumb, moveExtremes, type SpritePart } from './sprites';

const GHOST_PX = 256;
let ghostCanvas: HTMLCanvasElement;
let ghostCtx: CanvasRenderingContext2D;
// Identity of the carried art; the ghost bitmap is rebuilt only when it
// changes, while its position updates on every mousemove.
let ghostKey = '';

interface Viewport {
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
}

function offscreen(v: Viewport, x: number, y: number, w: number, h: number): boolean {
  return x + w < v.scrollX || x > v.scrollX + v.viewW || y + h < v.scrollY || y > v.scrollY + v.viewH;
}

// Side of the square marker drawn for types the game never draws.
function placeholderSize(cs: number): number {
  return Math.max(14, Math.min(48, cs * 0.35));
}

function defMirrored(def: ObjectDef): boolean {
  return !!def.mirror || isMirrored(def.id, def.variant ?? 0, def.sub ?? 0);
}

// The canvas blits the same 1x paintThumb output the tray shows, so the two
// can never diverge.
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

// White silhouette of a moving platform (without badges), drawn at both
// ends of its travel.
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
  const out = { cvs, bb: spriteBBox(core) };
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

// Mousemove storms are coalesced into one paint per frame; clicks and drops
// call draw() directly for instant feedback.
let drawQueued = false;
export function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}

function strokeGridLines(ctx: CanvasRenderingContext2D, v: Viewport, tileCs: number,
  cols: [number, number], rows: [number, number], skip: (t: number) => boolean) {
  ctx.beginPath();
  for (let t = cols[0]; t <= cols[1]; t++) {
    if (skip(t)) continue;
    const x = Math.round(t * tileCs) + 0.5;
    ctx.moveTo(x, v.scrollY); ctx.lineTo(x, v.scrollY + v.viewH);
  }
  for (let t = rows[0]; t <= rows[1]; t++) {
    if (skip(t)) continue;
    const y = Math.round(t * tileCs) + 0.5;
    ctx.moveTo(v.scrollX, y); ctx.lineTo(v.scrollX + v.viewW, y);
  }
  ctx.stroke();
}

// One line per 16px tile, under the blocks: 35% at block edges, 18% every
// 8 tiles, 8% otherwise. Batched by style and clipped to the viewport.
function drawGridlines(ctx: CanvasRenderingContext2D, v: Viewport, cs: number) {
  const { grid } = S;
  const tileCs = cs / 16;
  const cols: [number, number] = [
    Math.max(0, Math.floor(v.scrollX / tileCs) - 1),
    Math.min(grid[0].length * 16, Math.ceil((v.scrollX + v.viewW) / tileCs) + 1),
  ];
  const rows: [number, number] = [
    Math.max(0, Math.floor(v.scrollY / tileCs) - 1),
    Math.min(grid.length * 16, Math.ceil((v.scrollY + v.viewH) / tileCs) + 1),
  ];
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(128,128,128,0.35)';
  strokeGridLines(ctx, v, tileCs, cols, rows, (t) => t % 16 !== 0);
  ctx.strokeStyle = 'rgba(128,128,128,0.18)';
  strokeGridLines(ctx, v, tileCs, cols, rows, (t) => t % 8 !== 0 || t % 16 === 0);
  ctx.strokeStyle = 'rgba(128,128,128,0.08)';
  strokeGridLines(ctx, v, tileCs, cols, rows, (t) => t % 8 === 0);
}

function drawBlocks(ctx: CanvasRenderingContext2D, v: Viewport, cs: number) {
  const { grid, spritesheetImg } = S;
  const c0 = Math.max(0, Math.floor(v.scrollX / cs) - 1);
  const r0 = Math.max(0, Math.floor(v.scrollY / cs) - 1);
  const c1 = Math.min(grid[0].length, Math.ceil((v.scrollX + v.viewW) / cs) + 1);
  const r1 = Math.min(grid.length, Math.ceil((v.scrollY + v.viewH) / cs) + 1);
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
}

// Draws the sprite through its cached thumb (or directly while images are
// loading). Returns its on-canvas box, or null when it is offscreen.
function drawSprite(ctx: CanvasRenderingContext2D, v: Viewport, k: number, parts: SpritePart[],
  type: number, sub: number, variant: number, mirror: boolean, x: number, y: number) {
  const bb = spriteBBox(parts);
  const box = { x: (x + bb.x) * k, y: (y + bb.y) * k, w: bb.w * k, h: bb.h * k };
  if (offscreen(v, box.x, box.y, box.w, box.h)) return null;
  const t = thumbFor(type, sub, variant, mirror);
  ctx.imageSmoothingEnabled = false;
  if (t) ctx.drawImage(t, 0, 0, t.width, t.height, box.x, box.y, box.w, box.h);
  else drawParts(ctx, parts, x, y, k, mirror);
  return box;
}

// Moving platforms: 50% white silhouettes at both ends of their travel.
function drawMoveExtremes(ctx: CanvasRenderingContext2D, v: Viewport, k: number,
  type: number, sub: number, variant: number, mirror: boolean, x: number, y: number) {
  const extremes = moveExtremes(type, sub);
  if (!extremes.length) return;
  const wt = whiteThumbFor(type, sub, variant, mirror);
  if (!wt) return;
  ctx.imageSmoothingEnabled = false;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.5;
  for (const ex of extremes) {
    const ex0 = (x + ex.dx + wt.bb.x) * k;
    const ey0 = (y + ex.dy + wt.bb.y) * k;
    const ew = wt.bb.w * k, eh = wt.bb.h * k;
    if (offscreen(v, ex0, ey0, ew, eh)) continue;
    ctx.drawImage(wt.cvs, 0, 0, wt.cvs.width, wt.cvs.height, ex0, ey0, ew, eh);
  }
  ctx.globalAlpha = prevAlpha;
}

// Labelled marker for types the game itself never draws.
function drawPlaceholder(ctx: CanvasRenderingContext2D, v: Viewport, cs: number, type: number, x: number, y: number, selected: boolean) {
  const dx = (x / BLOCK_PX) * cs;
  const dy = (y / BLOCK_PX) * cs;
  const m = placeholderSize(cs);
  if (offscreen(v, dx - m, dy - m, 2 * m, 2 * m)) return;
  const def = findDef(type);
  ctx.fillStyle = selected ? 'rgba(255,80,80,0.7)' : 'rgba(160,160,160,0.5)';
  ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
  ctx.strokeStyle = selected ? '#f00' : '#666';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(dx - m / 2, dy - m / 2, m, m);
  ctx.setLineDash([]);
  if (cs >= 24) {
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(8, Math.round(m / 3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def ? def.name.split(' ')[0] : `${type}`, dx, dy);
  }
}

function drawObjects(ctx: CanvasRenderingContext2D, v: Viewport, cs: number) {
  const k = spriteScale(cs);
  S.objects.forEach((obj, i) => {
    const selected = i === S.selectedObjIdx;
    const parts = partsFor(obj.type, obj.sub, obj.variant);
    if (!parts) {
      drawPlaceholder(ctx, v, cs, obj.type, obj.x, obj.y, selected);
      return;
    }
    const mirror = isMirrored(obj.type, obj.variant, obj.sub);
    const box = drawSprite(ctx, v, k, parts, obj.type, obj.sub, obj.variant, mirror, obj.x, obj.y);
    if (!box || !selected) return;
    drawMoveExtremes(ctx, v, k, obj.type, obj.sub, obj.variant, mirror, obj.x, obj.y);
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6);
    ctx.setLineDash([]);
  });
}

// glowey.png pulsing over the hovered cell when it holds a tile.
function drawHoverGlow(ctx: CanvasRenderingContext2D, cs: number) {
  const img = S.gloweyImg;
  if (!hoverGlowActive() || !img?.complete || img.naturalWidth <= 0) return;
  ctx.imageSmoothingEnabled = true;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = glowAlpha();
  try { ctx.drawImage(img, S.hoverBx * cs, S.hoverBy * cs, cs, cs); }
  catch (_) { /* image not ready yet */ }
  ctx.globalAlpha = prevAlpha;
}

// Snapped drop preview for objects while a palette drag is over the grid
// (tiles only use the HTML ghost).
function drawDropPreview(ctx: CanvasRenderingContext2D, v: Viewport, cs: number) {
  const def = S.paletteDragDef;
  if (!S.paletteDrag || !S.previewOnCanvas || S.activeTab === 'tiles' || !def) return;
  const sub = def.sub ?? 0, variant = def.variant ?? 0;
  const px = S.previewPX, py = S.previewPY;
  const parts = partsFor(def.id, sub, variant);
  if (parts) {
    const k = spriteScale(cs);
    const mirror = defMirrored(def);
    drawSprite(ctx, v, k, parts, def.id, sub, variant, mirror, px, py);
    drawMoveExtremes(ctx, v, k, def.id, sub, variant, mirror, px, py);
    return;
  }
  const dx = (px / BLOCK_PX) * cs, dy = (py / BLOCK_PX) * cs;
  const m = placeholderSize(cs);
  if (offscreen(v, dx - m, dy - m, 2 * m, 2 * m)) return;
  ctx.fillStyle = 'rgba(255,200,0,0.5)';
  ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
}

// The canvas is viewport-sized and sticky inside the grid-sized
// .canvas-inner, so drawing uses grid coordinates under a scroll transform
// and every pass culls to the viewport.
export function draw() {
  const { ctx, canvas: cvs, canvasWrap } = S;
  if (!ctx || !cvs || !canvasWrap) return;
  const cs = cellSize();
  const v: Viewport = {
    scrollX: canvasWrap.scrollLeft,
    scrollY: canvasWrap.scrollTop,
    viewW: canvasWrap.clientWidth || cvs.width,
    viewH: canvasWrap.clientHeight || cvs.height,
  };
  ctx.setTransform(1, 0, 0, 1, -v.scrollX, -v.scrollY);
  ctx.fillStyle = '#f4f9f4';
  ctx.fillRect(v.scrollX, v.scrollY, v.viewW, v.viewH);
  drawGridlines(ctx, v, cs);
  drawBlocks(ctx, v, cs);
  drawObjects(ctx, v, cs);
  drawHoverGlow(ctx, cs);
  drawDropPreview(ctx, v, cs);
  drawTileSelection(v, cs);
}

// ── Object picking ──

/** Topmost object whose drawn box contains the canvas-px point, or -1.
 *  Uses draw()'s geometry, so clicks on bare tile art fall through to the
 *  tile. Transparent padding inside the box still counts as a hit. */
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
      const dx = (obj.x / BLOCK_PX) * cs, dy = (obj.y / BLOCK_PX) * cs;
      const m = placeholderSize(cs);
      if (mx >= dx - m / 2 && mx < dx + m / 2 && my >= dy - m / 2 && my < dy + m / 2) return i;
    }
  }
  return -1;
}

// ── Tile selection: outline + remove badge ──

/** Center and radius of a cell's remove badge (shared with the hit-test). */
export function tileBadge(bx: number, by: number, cs: number): { cx: number; cy: number; r: number } | null {
  if (bx < 0 || by < 0 || by >= S.grid.length || bx >= S.grid[0].length) return null;
  const r = Math.max(5, Math.min(10, cs * 0.15));
  // Top-right corner, nudged down by one tile (cs/16).
  return { cx: (bx + 1) * cs, cy: by * cs + cs / 16, r };
}

/** True when the selected tile is still filled. */
function selectedTileLive(): boolean {
  const { selectedTileBx: bx, selectedTileBy: by, grid } = S;
  return bx >= 0 && by >= 0 && by < grid.length && bx < grid[0].length && grid[by][bx] > 0;
}

export function hitTileBadge(mx: number, my: number, cs: number): boolean {
  if (!selectedTileLive()) return false;
  const b = tileBadge(S.selectedTileBx, S.selectedTileBy, cs);
  if (!b) return false;
  const dx = mx - b.cx, dy = my - b.cy;
  const rr = b.r + 2; // click tolerance
  return dx * dx + dy * dy <= rr * rr;
}

function drawBadge(ctx: CanvasRenderingContext2D, b: { cx: number; cy: number; r: number }) {
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

function drawTileSelection(v: Viewport, cs: number) {
  if (!selectedTileLive()) return;
  const bx = S.selectedTileBx, by = S.selectedTileBy;
  const x0 = bx * cs, y0 = by * cs;
  const b = tileBadge(bx, by, cs)!;
  if (offscreen(v, x0 - b.r, y0 - b.r, cs + 2 * b.r, cs + 2 * b.r)) return;
  const { ctx } = S;
  if (!ctx) return;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(x0, y0, cs, cs);
  drawBadge(ctx, b);
}

// ── Hover-glow pulse ──

const GLOW_PERIOD_MS = 1600; // one full fade in and out

/** Sine pulse from 0 (invisible) to 1 (full glow) and back. */
export function glowAlpha(now = performance.now()): number {
  const phase = (now % GLOW_PERIOD_MS) / GLOW_PERIOD_MS;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

function hoverGlowActive(): boolean {
  const { grid, hoverBx, hoverBy } = S;
  return hoverBx >= 0 && hoverBy >= 0
    && hoverBy < grid.length && hoverBx < grid[0].length
    && grid[hoverBy][hoverBx] > 0;
}

let glowRaf = 0;

/** Redraws every frame while the glow is visible. Safe to call on every
 *  mousemove: only one loop ever runs, and it stops by itself. */
export function ensureGlowLoop() {
  if (glowRaf || !hoverGlowActive()) return;
  const tick = () => {
    if (!hoverGlowActive()) { glowRaf = 0; return; }
    draw();
    glowRaf = requestAnimationFrame(tick);
  };
  glowRaf = requestAnimationFrame(tick);
}

// ── Palette-drag ghost ──
// The HTML ghost follows the cursor everywhere. Over the grid, draw() also
// paints the snapped drop preview (and travel extremes) underneath it.

// canvasToWorld also works for events outside the canvas.
function syncDropPreview(e: MouseEvent) {
  S.previewOnCanvas = false;
  if (!S.canvas) return;
  try {
    const { bx, by, px, py } = canvasToWorld(e);
    S.previewOnCanvas = inGrid(bx, by);
    S.previewPX = snap8(px);
    S.previewPY = snap8(py);
  } catch (_) { S.previewOnCanvas = false; }
}

function ghostIdentity(cs: number): string {
  const def = S.paletteDragDef;
  if (S.activeTab === 'tiles') return `t:${S.paletteDragTile}|${S.spritesheetImg?.complete ? 1 : 0}|${cs}`;
  if (def) return `o:${def.id}|${def.sub ?? 0}|${def.variant ?? 0}|${defMirrored(def)}|${cs}`;
  return `x|${cs}`;
}

function showTileGhost(ghostEl: HTMLElement, img: HTMLImageElement, rebuild: boolean) {
  if (rebuild) {
    ghostCtx.clearRect(0, 0, GHOST_PX, GHOST_PX);
    const { x: sx, y: sy } = blockSheetXY(S.paletteDragTile);
    ghostCtx.imageSmoothingEnabled = false;
    ghostCtx.drawImage(img, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, GHOST_PX, GHOST_PX);
    ghostEl.style.backgroundImage = `url(${ghostCanvas.toDataURL()})`;
    ghostEl.style.backgroundSize = '100% 100%';
  }
  ghostEl.style.display = '';
}

// True-scale, bbox-sized sprite preview.
function showSpriteGhost(ghostEl: HTMLElement, e: MouseEvent, def: ObjectDef, url: string, cs: number, rebuild: boolean) {
  const k = spriteScale(cs);
  const bb = spriteBBox(partsFor(def.id, def.sub ?? 0, def.variant ?? 0)!);
  ghostEl.style.width = Math.max(1, bb.w * k) + 'px';
  ghostEl.style.height = Math.max(1, bb.h * k) + 'px';
  ghostEl.style.left = (e.clientX + bb.x * k) + 'px';
  ghostEl.style.top = (e.clientY + bb.y * k) + 'px';
  if (rebuild) {
    ghostEl.style.backgroundImage = `url(${url})`;
    ghostEl.style.backgroundSize = '100% 100%';
  }
  ghostEl.style.backgroundRepeat = 'no-repeat';
  ghostEl.style.backgroundPosition = 'center';
  ghostEl.style.backgroundColor = 'rgba(0,0,0,0.3)';
  ghostEl.style.display = '';
  ghostEl.textContent = '';
}

function showTextGhost(ghostEl: HTMLElement, label: string) {
  ghostEl.style.backgroundImage = 'none';
  ghostEl.style.backgroundColor = 'rgba(255,200,0,0.5)';
  ghostEl.style.display = 'flex';
  ghostEl.style.alignItems = 'center';
  ghostEl.style.justifyContent = 'center';
  ghostEl.style.fontSize = '10px';
  ghostEl.style.color = '#fff';
  ghostEl.style.textAlign = 'center';
  ghostEl.textContent = label;
}

export function updateGhost(e: MouseEvent) {
  const { ghostEl, spritesheetImg, activeTab } = S;
  if (!ghostEl) return;
  if (!S.paletteDrag) {
    hideGhost();
    return;
  }
  syncDropPreview(e);
  const cs = cellSize();
  const key = ghostIdentity(cs);
  const rebuild = key !== ghostKey;
  ghostKey = key;
  ghostEl.classList.add('visible');
  ghostEl.style.display = '';
  ghostEl.style.width = cs + 'px';
  ghostEl.style.height = cs + 'px';
  ghostEl.style.left = (e.clientX - cs / 2) + 'px';
  ghostEl.style.top = (e.clientY - cs / 2) + 'px';
  const def = S.paletteDragDef;
  if (activeTab === 'tiles' && spritesheetImg?.complete) {
    showTileGhost(ghostEl, spritesheetImg, rebuild);
  } else if (def) {
    const url = spriteThumbURL(def.id, def.sub ?? 0, def.variant ?? 0, defMirrored(def));
    if (url && partsFor(def.id, def.sub ?? 0, def.variant ?? 0)) showSpriteGhost(ghostEl, e, def, url, cs, rebuild);
    else showTextGhost(ghostEl, def.name.split(' ')[0]);
  } else {
    showTextGhost(ghostEl, '');
  }
  if (S.previewOnCanvas && S.activeTab !== 'tiles') requestDraw();
}

export function hideGhost() {
  const { ghostEl } = S;
  ghostKey = '';
  S.previewOnCanvas = false;
  if (!ghostEl) return;
  ghostEl.classList.remove('visible');
  ghostEl.style.display = '';
}
