// ts/sprites.ts — WYSIWYG object sprites, mined from decompiled 52.swf.
//
// Provenance: scripts/MainCanvas.as (ffdec export of games/swf/52/52.swf).
// Every entry below mirrors the game's own idle draw call:
//   - cell (sx,sy,w,h) = the exact source rect (drawMapSprite literals or
//     framedata.bin cells used by drawFrame),
//   - anchor/offset   = the exact ANCHOR_* + position expression,
//   - image           = the PNG registered by createImage for ZONE_CUSTOM
//     (default/ + zone_greenhill/ only — that is all a custom level loads).
//
// Rules the game itself follows (so the editor matches exactly):
//   - PNGs already carry real alpha; no color-keying exists anywhere.
//   - Uniform scale only (cellSize()/BLOCK_PX on both axes) — never stretched.
//   - Types with no GH art or no draw routine are game-invisible; they get
//     no entry here and the editor keeps a placeholder marker for them.

import { BLOCK_PX } from './format';

export type Anchor = 'center' | 'topleft' | 'bottomcenter';

export interface SpritePart {
  img: string; // root-absolute asset URL
  sx: number; sy: number; w: number; h: number; // source cell, native px
  ox: number; oy: number; // anchor-point offset from object origin, game px
  anchor: Anchor;
}

const D = '/games/swf/52/res/images/default/';
const G = '/games/swf/52/res/images/zone_greenhill/';

function p(img: string, sx: number, sy: number, w: number, h: number,
           ox: number, oy: number, anchor: Anchor): SpritePart {
  return { img, sx, sy, w, h, ox, oy, anchor };
}

// Bridge/pole rows: 12 segments spanning x-96..x+80 (game draws the row
// centered on the origin: objectData[2] - 96 + i*16).
function row(img: string, sx: number, sy: number, w: number, h: number): SpritePart[] {
  const parts: SpritePart[] = [];
  for (let i = 0; i < 12; i++) parts.push(p(img, sx, sy, w, h, -96 + i * 16, 0, 'center'));
  return parts;
}

export const SPRITES: Record<number, SpritePart[]> = {
  // Essentials
  151: [p(D + 'sonic.png', 0, 0, 29, 40, 0, 0, 'center')], // framedata[151][0]
  44: [p(D + 'gole.png', 0, 0, 48, 48, 0, 10, 'center')], // goal_draw idle
  // Star post idle (objectData[5]==0): top + base (save_draw)
  36: [
    p(D + 'save.png', 0, 16, 16, 16, 0, -36, 'center'),
    p(D + 'save.png', 0, 32, 16, 48, 0, -4, 'center'),
  ],
  // Rings share the type-0 image (ring_draw); fan-out added in ringParts()
  0: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  1: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  63: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  64: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  65: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  66: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  67: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  68: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  69: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  // Giant ring has NO draw routine in-game; show its registered art so the
  // object can still be seen and grabbed in the editor.
  47: [p(D + 'ring_large.png', 0, 0, 64, 256, 0, 0, 'center')],
  // Springs idle (spring_draw case 0, frame 0): BOTTOM|HCENTER at (x, y+8)
  2: [p(D + 'sjump.png', 0, 0, 32, 16, 0, 8, 'bottomcenter')], // framedata[2][0]
  153: [p(D + 'sjump2.png', 0, 0, 32, 16, 0, 8, 'bottomcenter')], // framedata[153][0]
  // Spikes default (var 0): full sheet centered (spike_draw else-branch)
  9: [p(D + 'toge.png', 0, 0, 40, 32, 0, 0, 'center')],
  // Tall bridge: 12 animated 16x24 segments, idle row 0 (thorn_draw)
  4: row(G + 'thashi.png', 0, 0, 16, 24),
  // Bridge: 12 segments of cell (32,0,16,16), idle sag 0 (bridge_draw)
  5: row(G + 'hashi.png', 32, 0, 16, 16),
  // Breakable wall idle: whole 96x96 sheet, center at (x, y-8) (break_draw)
  6: [p(G + 'break.png', 0, 0, 96, 96, 0, -8, 'center')],
  // GH breakable idle (var 0): two 16x16 columns, TOP|LEFT (breakable_draw)
  18: [
    p(G + 'brkabe_g.png', 0, 0, 16, 16, -16, -32, 'topleft'),
    p(G + 'brkabe_g.png', 16, 0, 16, 16, 0, -32, 'topleft'),
  ],
  // Swing seat (GH branch): cell (16,16,16,16) at origin (swinging_platform_draw)
  3: [p(D + 'buranko.png', 16, 16, 16, 16, 0, 0, 'center')],
  // Switch unpressed: base + stem (switch2_draw, switchflag[var]==false)
  15: [
    p(D + 'switch2.png', 0, 0, 32, 11, 0, -3, 'center'),
    p(D + 'switch2.png', 0, 11, 32, 5, 0, 5, 'center'),
  ],
  // Button: shown on touch in-game (bonus_draw gates on state); preview idle art
  45: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  // Enemies via drawChara (framedata frame 0, HCENTER|VCENTER)
  41: [p(G + 'musi.png', 0, 0, 40, 32, 0, 0, 'center')], // framedata[41][0]
  40: [p(G + 'hachi.png', 0, 0, 48, 32, 0, 0, 'center')], // hachi_draw -> drawChara f0
  86: [p(G + 'fish.png', 0, 0, 32, 32, 0, 0, 'center')], // framedata[86][0]
  39: [p(G + 'kamere.png', 0, 0, 56, 40, 0, 0, 'center')], // framedata[39][0]
  57: [p(G + 'kani.png', 0, 0, 48, 32, 0, 0, 'center')], // framedata[57][0]
};

// Ring fan-out per addObjectSet: one entry spawns 1+sub rings stepped by layout.
// (sub is read signed in-game; clamp to the 0..127 range the engine honors.)
export function ringParts(type: number, sub: number): SpritePart[] {
  const base = SPRITES[type][0];
  const n = 1 + Math.max(0, Math.min(127, sub));
  const steps: Record<number, [number, number]> = {
    0: [24, 0], 1: [0, 24],
    63: [-16, 16], 64: [16, 16], 65: [32, 32],
    66: [16, 0], 67: [32, 0], 68: [0, 16], 69: [0, 32],
  };
  const [dx, dy] = steps[type] ?? [0, 0];
  const parts: SpritePart[] = [];
  for (let i = 0; i < n; i++) {
    parts.push({ ...base, ox: base.ox + i * dx, oy: base.oy + i * dy });
  }
  return parts;
}

const RING_TYPES = new Set([0, 1, 63, 64, 65, 66, 67, 68, 69]);

/** Full part list for a placed object (with ring expansion). */
export function partsFor(type: number, sub: number): SpritePart[] | null {
  if (!(type in SPRITES)) return null;
  if (RING_TYPES.has(type)) return ringParts(type, sub);
  return SPRITES[type];
}

// ── Image cache (native alpha, no keying — the PNGs are already transparent) ──

const cache = new Map<string, HTMLImageElement>();

export function spriteImg(url: string): HTMLImageElement {
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    cache.set(url, img);
  }
  return img;
}

/** Kick off loads for every registered sprite; redraw after each arrives. */
export function preloadSprites(onOneReady: () => void) {
  const urls = new Set<string>();
  for (const t of Object.keys(SPRITES)) {
    for (const part of SPRITES[Number(t)]) urls.add(part.img);
  }
  for (const url of urls) {
    const img = spriteImg(url);
    if (img.complete) continue;
    img.onload = onOneReady;
  }
}

/** Bounding box of parts in game px, relative to object origin. */
export function spriteBBox(parts: SpritePart[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const part of parts) {
    let px = part.ox, py = part.oy;
    if (part.anchor === 'center') { px -= part.w / 2; py -= part.h / 2; }
    else if (part.anchor === 'bottomcenter') { px -= part.w / 2; py -= part.h; }
    x0 = Math.min(x0, px); y0 = Math.min(y0, py);
    x1 = Math.max(x1, px + part.w); y1 = Math.max(y1, py + part.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Draw parts at a game-px origin. k = canvas px per game px (uniform, no stretch). */
export function drawParts(
  ctx: CanvasRenderingContext2D,
  parts: SpritePart[],
  gx: number, gy: number, k: number,
) {
  ctx.imageSmoothingEnabled = false;
  for (const part of parts) {
    const img = spriteImg(part.img);
    if (!img.complete || img.naturalWidth === 0) continue;
    const ax = (gx + part.ox) * k, ay = (gy + part.oy) * k;
    const dw = part.w * k, dh = part.h * k;
    let dx = ax, dy = ay;
    if (part.anchor === 'center') { dx = ax - dw / 2; dy = ay - dh / 2; }
    else if (part.anchor === 'bottomcenter') { dx = ax - dw / 2; dy = ay - dh; }
    ctx.drawImage(img, part.sx, part.sy, part.w, part.h, dx, dy, dw, dh);
  }
}

/** Game-px → canvas-px factor for the current zoom. */
export function spriteScale(cellSize: number): number {
  return cellSize / BLOCK_PX;
}

/** Paint parts fitted+centered into a square ctx. False if art not loaded yet. */
export function paintFitted(
  c: CanvasRenderingContext2D,
  parts: SpritePart[],
  size = 256,
  pad = 8,
): boolean {
  for (const part of parts) {
    const img = spriteImg(part.img);
    if (!img.complete || img.naturalWidth === 0) return false;
  }
  const bb = spriteBBox(parts);
  const k = Math.min((size - pad * 2) / bb.w, (size - pad * 2) / bb.h);
  const gx0 = size / 2 / k - (bb.x + bb.w / 2);
  const gy0 = size / 2 / k - (bb.y + bb.h / 2);
  c.clearRect(0, 0, size, size);
  drawParts(c, parts, gx0, gy0, k);
  return true;
}

const thumbURLCache = new Map<number, string>();

/** Cached dataURL of the fitted composite (for the drag ghost). Null until loaded. */
export function spriteThumbURL(typeId: number): string | null {
  const parts = partsFor(typeId, 0);
  if (!parts) return null;
  const hit = thumbURLCache.get(typeId);
  if (hit) return hit;
  const cvs = document.createElement('canvas');
  cvs.width = 256;
  cvs.height = 256;
  if (!paintFitted(cvs.getContext('2d')!, parts)) return null;
  const url = cvs.toDataURL();
  thumbURLCache.set(typeId, url);
  return url;
}
