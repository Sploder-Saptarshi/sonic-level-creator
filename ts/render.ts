// ts/render.ts — Canvas drawing + ghost preview

import { BLOCK_PX, TOTAL_BLOCKS, blockSheetXY } from './format';
import { S, cellSize, findDef } from './state';

const GHOST_PX = 256;
let ghostCanvas: HTMLCanvasElement;
let ghostCtx: CanvasRenderingContext2D;

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

  // objects: point markers centered on the exact pixel position
  // (placements are free pixels, not tile corners)
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const dx = (obj.x / BLOCK_PX) * cs;
    const dy = (obj.y / BLOCK_PX) * cs;
    const m = Math.max(14, Math.min(48, cs * 0.35));
    if (dx + m < scrollX || dx - m > scrollX + viewW || dy + m < scrollY || dy - m > scrollY + viewH) continue;
    const isSel = i === S.selectedObjIdx;
    const def = findDef(obj.type);
    ctx.fillStyle = isSel ? 'rgba(255,80,80,0.7)' : 'rgba(255,200,0,0.6)';
    ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
    ctx.strokeStyle = isSel ? '#f00' : '#880';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx - m / 2, dy - m / 2, m, m);
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
  } else {
    ghostEl.style.backgroundImage = 'none';
    ghostEl.style.backgroundColor = 'rgba(255,200,0,0.5)';
    ghostEl.style.display = 'flex';
    ghostEl.style.alignItems = 'center';
    ghostEl.style.justifyContent = 'center';
    ghostEl.style.fontSize = '10px';
    ghostEl.style.color = '#fff';
    ghostEl.style.textAlign = 'center';
    ghostEl.textContent = S.paletteDragDef ? S.paletteDragDef.name.split(' ')[0] : '';
  }
}

export function hideGhost() {
  const { ghostEl } = S;
  if (!ghostEl) return;
  ghostEl.classList.remove('visible');
  ghostEl.style.display = '';
}
