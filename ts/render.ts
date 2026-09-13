// ts/render.ts — Canvas drawing + ghost preview

import { BLOCK_PX, TOTAL_BLOCKS, blockSheetXY } from './format';
import { S, cellSize, findDef } from './state';
import { partsFor, spriteBBox, drawParts, spriteScale, spriteThumbURL, isMirrored, paintThumb } from './sprites';

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

  ctx.fillStyle = '#d4e8c0';
  ctx.fillRect(0, 0, W, H);

  const c0 = Math.max(0, Math.floor(scrollX / cs) - 1);
  const r0 = Math.max(0, Math.floor(scrollY / cs) - 1);
  const c1 = Math.min(grid[0].length, Math.ceil((scrollX + viewW) / cs) + 1);
  const r1 = Math.min(grid.length, Math.ceil((scrollY + viewH) / cs) + 1);

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

  // gridlines (absolute coords, span full canvas)
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let r = r0; r <= r1; r++) {
    const y = Math.round(r * cs) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let c = c0; c <= c1; c++) {
    const x = Math.round(c * cs) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
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
}

// ── Ghost preview (follows cursor during palette drag) ──

export function updateGhost(e: MouseEvent) {
  const { ghostEl, spritesheetImg, activeTab } = S;
  if (!ghostEl) return;
  if (!S.paletteDrag) {
    hideGhost();
    return;
  }
  const cs = cellSize();
  ghostEl.classList.add('visible');
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
      // True-scale preview: the ghost div matches exactly what draw() will
      // paint — bbox-sized at canvas scale, offset by the bbox origin, with
      // the drop point (cursor) as the object origin. NOT cell-filling.
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
}

export function hideGhost() {
  const { ghostEl } = S;
  if (!ghostEl) return;
  ghostEl.classList.remove('visible');
  ghostEl.style.display = '';
}
