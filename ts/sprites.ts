import { BLOCK_PX } from './format';
import { BADGE_ORANGE, BADGE_WHITE, partsFor, spriteBBox, spriteImageUrls, type SpritePart } from './spriteData';

const cache = new Map<string, HTMLImageElement>();

function spriteImg(url: string): HTMLImageElement {
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    cache.set(url, img);
  }
  return img;
}

export function preloadSprites(onOneReady: () => void) {
  for (const url of spriteImageUrls()) {
    const img = spriteImg(url);
    if (!img.complete) img.onload = onOneReady;
  }
}

export function drawParts(
  ctx: CanvasRenderingContext2D,
  parts: SpritePart[],
  gx: number, gy: number, k: number,
  mirror = false,
) {
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.save();
    ctx.translate(2 * gx * k, 0);
    ctx.scale(-1, 1);
  }
  for (const part of parts) {
    if (part.badge) { drawBadge(ctx, part, gx, gy, k); continue; }
    const img = spriteImg(part.img);
    if (!img.complete || img.naturalWidth === 0) continue;
    const ax = (gx + part.ox) * k, ay = (gy + part.oy) * k;
    const dw = part.w * k, dh = part.h * k;
    if (part.rot || part.flip) {
      // The game mirrors before rotating; canvas transforms apply in reverse.
      // Don't swap w/h here, the rotation already does.
      ctx.save();
      ctx.translate(ax, ay);
      if (part.rot) ctx.rotate(part.rot * Math.PI / 180);
      if (part.flip) ctx.scale(-1, 1);
      const rw = dw, rh = dh;
      let rx = 0, ry = 0;
      if (part.anchor === 'center') { rx = -rw / 2; ry = -rh / 2; }
      else if (part.anchor === 'bottomcenter') { rx = -rw / 2; ry = -rh; }
      ctx.drawImage(img, part.sx, part.sy, part.w, part.h, rx, ry, rw, rh);
      ctx.restore();
      continue;
    }
    let dx = ax, dy = ay;
    if (part.anchor === 'center') { dx = ax - dw / 2; dy = ay - dh / 2; }
    else if (part.anchor === 'bottomcenter') { dx = ax - dw / 2; dy = ay - dh; }
    ctx.drawImage(img, part.sx, part.sy, part.w, part.h, dx, dy, dw, dh);
  }
  if (mirror) ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  part: SpritePart,
  gx: number, gy: number, k: number,
) {
  const b = part.badge!;
  const cx = (gx + part.ox) * k, cy = (gy + part.oy) * k;
  const bw = part.w * k, bh = part.h * k;
  ctx.save();
  if (b.kind === 'ring') {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(bw, bh) / 2, 0, Math.PI * 2);
    ctx.fillStyle = BADGE_WHITE;
    ctx.fill();
  } else {
    let ox = 0, oy = 0;
    if (b.dir === 'up') oy = -bh / 6;
    else if (b.dir === 'down') oy = bh / 6;
    else if (b.dir === 'left') ox = -bw / 6;
    else ox = bw / 6;
    const ccx = cx + ox, ccy = cy + oy;
    const x0 = ccx - bw / 2, y0 = ccy - bh / 2;
    const x1 = ccx + bw / 2, y1 = ccy + bh / 2;
    ctx.beginPath();
    if (b.dir === 'up') { ctx.moveTo(ccx, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); }
    else if (b.dir === 'down') { ctx.moveTo(ccx, y1); ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); }
    else if (b.dir === 'left') { ctx.moveTo(x0, ccy); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); }
    else { ctx.moveTo(x1, ccy); ctx.lineTo(x0, y0); ctx.lineTo(x0, y1); }
    ctx.closePath();
    ctx.fillStyle = b.fill ?? BADGE_ORANGE;
    ctx.fill();
  }
  ctx.restore();
}

export function spriteScale(cellSize: number): number {
  return cellSize / BLOCK_PX;
}

export function paintThumb(
  c: CanvasRenderingContext2D,
  parts: SpritePart[],
  scale = 3,
  mirror = false,
): boolean {
  for (const part of parts) {
    if (part.badge) continue; // vector, no image to wait for
    const img = spriteImg(part.img);
    if (!img.complete || img.naturalWidth === 0) return false;
  }
  const bb = spriteBBox(parts);
  const w = Math.max(1, Math.round(bb.w * scale));
  const h = Math.max(1, Math.round(bb.h * scale));
  if (c.canvas.width !== w || c.canvas.height !== h) {
    c.canvas.width = w;
    c.canvas.height = h;
  }
  c.clearRect(0, 0, w, h);
  if (mirror) {
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  drawParts(c, parts, Math.round(-bb.x * scale) / scale, Math.round(-bb.y * scale) / scale, scale);
  if (mirror) c.restore();
  return true;
}

const thumbURLCache = new Map<string, string>();
export function spriteThumbURL(typeId: number, sub = 0, variant = 0, mirror = false): string | null {
  const parts = partsFor(typeId, sub, variant);
  if (!parts) return null;
  const key = `${typeId}:${sub}:${variant}:${mirror ? 1 : 0}`;
  const hit = thumbURLCache.get(key);
  if (hit) return hit;
  const cvs = document.createElement('canvas');
  cvs.width = 256;
  cvs.height = 256;
  if (!paintThumb(cvs.getContext('2d')!, parts, 3, mirror)) return null;
  const url = cvs.toDataURL();
  thumbURLCache.set(key, url);
  return url;
}

