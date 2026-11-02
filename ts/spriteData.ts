// Source rects and anchors copied from the game's draw code (MainCanvas.as).
// Types the game never draws are left out and get a placeholder.

import { RING_STEPS } from './format';

export type Anchor = 'center' | 'topleft' | 'bottomcenter';

export interface SpritePart {
  img: string;
  sx: number; sy: number; w: number; h: number;
  ox: number; oy: number;
  anchor: Anchor;
  rot?: 0 | 90 | 180 | 270;
  flip?: boolean;
  badge?: { kind: 'ring' | 'tri'; dir?: BadgeDir; fill?: string };
}

type BadgeDir = 'up' | 'down' | 'left' | 'right';

const D = '/games/swf/52/res/images/default/';
const G = '/games/swf/52/res/images/zone_greenhill/';

function p(img: string, sx: number, sy: number, w: number, h: number,
           ox: number, oy: number, anchor: Anchor,
           rot?: 0 | 90 | 180 | 270, flip?: boolean): SpritePart {
  const part: SpritePart = { img, sx, sy, w, h, ox, oy, anchor };
  if (rot) part.rot = rot;
  if (flip) part.flip = flip;
  return part;
}

function row(img: string, sx: number, sy: number, w: number, h: number): SpritePart[] {
  const parts: SpritePart[] = [];
  for (let i = 0; i < 12; i++) parts.push(p(img, sx, sy, w, h, -96 + i * 16, 0, 'center'));
  return parts;
}

export const SPRITES: Record<number, SpritePart[]> = {
  151: [p(D + 'sonic.png', 0, 0, 29, 40, 0, 0, 'center')],
  44: [p(D + 'gole.png', 0, 0, 48, 48, 0, 10, 'center')],
  36: [
    p(D + 'save.png', 0, 16, 16, 16, 0, -36, 'center'),
    p(D + 'save.png', 0, 32, 16, 48, 0, -4, 'center'),
  ],
  0: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  1: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  63: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  64: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  65: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  66: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  67: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  68: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  69: [p(D + 'ring.png', 0, 0, 16, 16, 0, 0, 'center')],
  // not drawn in-game, but shown so it can be grabbed
  47: [p(D + 'ring_large.png', 0, 0, 64, 256, 0, 0, 'center')],
  2: [p(D + 'sjump.png', 0, 0, 32, 16, 0, 8, 'bottomcenter')],
  9: [p(D + 'toge.png', 0, 0, 40, 32, 0, 0, 'center')],
  4: row(G + 'thashi.png', 0, 0, 16, 24),
  5: row(G + 'hashi.png', 32, 0, 16, 16),
  6: [p(G + 'break.png', 0, 0, 96, 96, 0, -8, 'center')],
  18: breakableParts(0),
  3: swingParts(0),
  16: [p(G + 'shima.png', 0, 0, 64, 32, 0, 0, 'center')],
  90: [p(G + 'shima.png', 0, 0, 64, 32, 0, 0, 'center')],
  37: [p(G + 'kageb.png', 0, 0, 16, 64, 0, 0, 'center')],
  38: [p(G + 'hashi.png', 0, 0, 32, 16, 0, 0, 'center')],
  58: [p(G + 'jyama.png', 0, 0, 48, 32, 0, 0, 'center')],
  42: [p(D + 'item.png', 0, 0, 32, 32, 0, 0, 'center')],
  43: [p(D + 'item.png', 0, 0, 32, 32, 0, 0, 'center')],
  46: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  15: [
    p(D + 'switch2.png', 0, 0, 32, 11, 0, -3, 'center'),
    p(D + 'switch2.png', 0, 11, 32, 5, 0, 5, 'center'),
  ],
  45: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  41: [p(G + 'musi.png', 0, 0, 40, 32, 0, 0, 'center')],
  40: [p(G + 'hachi.png', 0, 0, 48, 32, 0, 0, 'center')],
  86: [p(G + 'fish.png', 0, 0, 32, 32, 0, 0, 'center')],
  39: [p(G + 'kamere.png', 0, 0, 56, 40, 0, 0, 'center')],
  57: [p(G + 'kani.png', 0, 0, 48, 32, 0, 0, 'center')],
};

function springParts(sub: number, variant: number): SpritePart[] {
  const img = sub % 16 === 2 ? D + 'sjump2.png' : D + 'sjump.png';
  const ori = Math.floor(sub / 16);
  if (ori === 1) {
    return variant === 0
      ? [p(img, 0, 0, 32, 16, 0, 0, 'center', 90)]
      : [p(img, 0, 0, 32, 16, 0, 0, 'center', 270, true)];
  }
  if (ori >= 2) return [p(img, 0, 0, 32, 16, 0, 0, 'center', 180, true)];
  return [p(img, 0, 0, 32, 16, 0, 8, 'bottomcenter')];
}

function spikeParts(sub: number, variant: number): SpritePart[] {
  const T = D + 'toge.png';
  const U = variant === 2;
  const R180 = U ? 180 as const : undefined;
  if (sub === 48) {
    return [-24, 0, 24].map(ox => p(T, 0, 0, 8, 32, ox, 0, 'center', R180));
  }
  if (sub === 64) {
    const parts: SpritePart[] = [];
    for (let i = 0; i < 6; i++) parts.push(p(T, 16, 0, 8, 32, -60 + i * 24, 0, 'center', R180));
    return parts;
  }
  if (sub === 16 || sub === 18) {
    return [p(T, 0, 0, 40, 32, -16, -20, 'topleft', variant === 0 ? 270 : 90)];
  }
  if (sub === 82) {
    return variant === 0
      ? [p(T, 16, 0, 8, 32, -16, -4, 'topleft', 270, true)]
      : [p(T, 16, 0, 8, 32, -16, -4, 'topleft', 90)];
  }
  if (sub === 32) return [p(T, 16, 0, 8, 32, 0, 0, 'center', R180)];
  return [p(T, 0, 0, 40, 32, 0, 0, 'center', R180)];
}

function swingParts(sub: number): SpritePart[] {
  const B = D + 'buranko.png';
  const parts: SpritePart[] = [p(B, 16, 16, 16, 16, 0, 0, 'center')];
  const n = Math.max(0, sub);
  for (let i = 1; i <= n; i++) parts.push(p(B, 16, 32, 16, 16, 0, i * 16, 'center'));
  parts.push(p(B, 0, 0, 48, 16, 0, (n + 1) * 16 - 8, 'center'));
  return parts;
}

const ITEM_ROWS = [8, 0, 4, 3, 2, 1, 0];
function monitorParts(sub: number): SpritePart[] | null {
  if (sub <= 0 || sub >= 7) return null;
  const row = ITEM_ROWS[sub] ?? 0;
  if (row === 8) return [p(D + 'item.png', 0, 256, 32, 16, 0, 8, 'center')];
  return [
    p(D + 'item.png', 0, row * 32, 32, 32, 0, 0, 'center'),
    p(D + 'item.png', 8, row * 32 + 7, 16, 14, 0, 0, 'center'),
  ];
}

function breakableParts(sub: number): SpritePart[] {
  const B = G + 'brkabe_g.png';
  const left = sub === 0 ? 0 : 16;
  const right = sub === 2 ? 32 : 16;
  const parts: SpritePart[] = [];
  for (let r = 0; r < 4; r++) {
    parts.push(p(B, left, 0, 16, 16, -16, -32 + r * 16, 'topleft'));
    parts.push(p(B, right, 0, 16, 16, 0, -32 + r * 16, 'topleft'));
  }
  return parts;
}

// Editor-only arrows on moving platforms; orange points the way it moves first.
const SHIMA_H_FIRST: Record<number, 'left' | 'right'> = { 1: 'left', 5: 'right', 12: 'right' };
const SHIMA_V_FIRST: Record<number, 'up' | 'down'> = { 2: 'up', 6: 'down', 11: 'up', 16: 'up' };

export const BADGE_ORANGE = '#ff8c00';
export const BADGE_WHITE = '#ffffff';
const BADGE_GRAY = '#888888';

function badgePart(
  kind: 'ring' | 'tri', dir: BadgeDir | undefined, fill: string,
  w: number, h: number, ox: number, oy: number,
): SpritePart {
  const part = p('', 0, 0, w, h, ox, oy, 'center');
  part.badge = { kind, dir, fill };
  return part;
}

function triPair(first: BadgeDir, axis: 'h' | 'v', cy = 0, scale = 1): SpritePart[] {
  const second: BadgeDir =
    axis === 'h' ? (first === 'left' ? 'right' : 'left') : (first === 'up' ? 'down' : 'up');
  const [w, h] = axis === 'h' ? [8 * scale, 12 * scale] : [12 * scale, 8 * scale];
  const [w2, h2] = [w * 0.75, h * 0.75];
  const at = (d: BadgeDir): [number, number] =>
    d === 'left' ? [-4 * scale, cy] : d === 'right' ? [4 * scale, cy] : d === 'up' ? [0, cy - 4 * scale] : [0, cy + 4 * scale];
  const [fx, fy] = at(first);
  const [sx, sy] = at(second);
  return [
    badgePart('tri', first, BADGE_ORANGE, w, h, fx, fy),
    badgePart('tri', second, BADGE_GRAY, w2, h2, sx, sy),
  ];
}

export function moveBadge(type: number, sub: number, cy = 0): SpritePart[] {
  if (type !== 16 && type !== 90) return [];
  const scale = sub === 16 ? 32 / 24 : 1;
  const ring = badgePart('ring', undefined, BADGE_WHITE, 24 * scale, 24 * scale, 0, cy);
  if (sub === 7) return [ring, badgePart('tri', 'up', BADGE_ORANGE, 12 * scale, 8 * scale, 0, cy)];
  if (sub === 3) return [ring, badgePart('tri', 'down', BADGE_ORANGE, 12 * scale, 8 * scale, 0, cy)];
  const h = SHIMA_H_FIRST[sub];
  if (h !== undefined) return [ring, ...triPair(h, 'h', cy, scale)];
  const v = SHIMA_V_FIRST[sub];
  if (v !== undefined) return [ring, ...triPair(v, 'v', cy, scale)];
  return [];
}

// travel amplitudes from shima_nflag_move
export function moveExtremes(type: number, sub: number): Array<{ dx: number; dy: number }> {
  if (type !== 16 && type !== 90) return [];
  const amp: Record<number, { ax: number; ay: number }> = {
    1: { ax: 64, ay: 0 },
    5: { ax: 64, ay: 0 },
    2: { ax: 0, ay: 64 },
    6: { ax: 0, ay: 64 },
    11: { ax: 0, ay: 48 },
    12: { ax: 0, ay: 48 },
    16: { ax: 0, ay: 32 },
  };
  const a = amp[sub];
  if (!a) return [];
  return [{ dx: -a.ax, dy: -a.ay }, { dx: a.ax, dy: a.ay }];
}

function monitorTable(): Record<number, SpritePart[]> {
  const table: Record<number, SpritePart[]> = {};
  for (let sub = 1; sub <= 6; sub++) {
    const parts = monitorParts(sub);
    if (parts) table[sub] = parts;
  }
  return table;
}
function buttonTable(): Record<number, SpritePart[]> {
  return {
    0: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
    1: [p(D + 'bten.png', 0, 48, 32, 24, 0, 0, 'center')],
    2: [p(D + 'bten.png', 0, 24, 32, 24, 0, 0, 'center')],
    3: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  };
}

function pillarParts(): SpritePart[] {
  return [
    p(G + 'shima.png', 0, 32, 64, 48, 0, 8, 'center'),
    ...[0, 1, 2, 3, 4, 5].map(i => p(G + 'shima.png', 0, 64, 64, 16, 0, 40 + i * 16, 'center')),
  ];
}

const SUBSPRITES: Record<number, Record<number, SpritePart[]>> = {
  42: monitorTable(),
  43: monitorTable(),
  45: buttonTable(),
  46: buttonTable(),
  16: { 16: pillarParts() },
  90: { 16: pillarParts() },
  37: {
    0: [p(G + 'kageb.png', 0, 0, 16, 64, 0, 0, 'center')],
    1: [p(G + 'kageb.png', 16, 0, 16, 64, 0, 0, 'center')],
    2: [p(G + 'kageb.png', 32, 0, 16, 64, 0, 0, 'center')],
    16: [p(G + 'kageb.png', 48, 0, 16, 64, 0, 0, 'center')],
    17: [p(G + 'kageb.png', 64, 0, 16, 64, 0, 0, 'center')],
    18: [p(G + 'kageb.png', 80, 0, 16, 64, 0, 0, 'center')],
  },
  18: {
    0: breakableParts(0),
    1: breakableParts(1),
    2: breakableParts(2),
  },
};
// the game reads sub as a signed byte
export function ringParts(type: number, sub: number): SpritePart[] {
  const base = SPRITES[type][0];
  const n = 1 + Math.max(0, Math.min(127, sub));
  const [dx, dy] = RING_STEPS[type] ?? [0, 0];
  const parts: SpritePart[] = [];
  for (let i = 0; i < n; i++) {
    parts.push({ ...base, ox: base.ox + i * dx, oy: base.oy + i * dy });
  }
  return parts;
}

const RING_TYPES = new Set([0, 1, 63, 64, 65, 66, 67, 68, 69]);

const partsCache = new Map<string, SpritePart[] | null>();
export function partsFor(type: number, sub = 0, variant = 0): SpritePart[] | null {
  const key = `${type}|${sub}|${variant}`;
  const hit = partsCache.get(key);
  if (hit !== undefined) return hit;
  const out = partsForUncached(type, sub, variant);
  partsCache.set(key, out);
  return out;
}

function partsForUncached(type: number, sub = 0, variant = 0): SpritePart[] | null {
  if (!(type in SPRITES)) return null;
  if (RING_TYPES.has(type)) return ringParts(type, sub);
  if (type === 2) return springParts(sub, variant);
  if (type === 9) return spikeParts(sub, variant);
  if (type === 3) return swingParts(sub);
  if (type === 42 || type === 43) return monitorParts(sub);
  if (type === 45 || type === 46) {
    const table = SUBSPRITES[type];
    return table[sub] ?? table[2];
  }
  if (type === 16 || type === 90) {
    const core = sub === 16 ? SUBSPRITES[type][16] : SPRITES[type];
    const bb = spriteBBox(core);
    const badge = moveBadge(type, sub, bb.y + bb.h / 2);
    return badge.length ? [...core, ...badge] : core;
  }
  if (type === 37) return SUBSPRITES[37][sub] ?? SPRITES[37];
  if (type === 18) return breakableParts(sub);
  return SPRITES[type];
}

function partCorners(part: SpritePart): [number, number][] {
  let x0 = 0, y0 = 0, x1 = part.w, y1 = part.h;
  if (part.anchor === 'center') { x0 = -part.w / 2; y0 = -part.h / 2; x1 = part.w / 2; y1 = part.h / 2; }
  else if (part.anchor === 'bottomcenter') { x0 = -part.w / 2; y0 = -part.h; x1 = part.w / 2; y1 = 0; }
  const pts: [number, number][] = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  return pts.map(([x, y]): [number, number] => {
    if (part.flip) x = -x;
    const r = part.rot ?? 0;
    if (r === 90) [x, y] = [-y, x];
    else if (r === 180) [x, y] = [-x, -y];
    else if (r === 270) [x, y] = [y, -x];
    return [part.ox + x, part.oy + y];
  });
}

const bboxCache = new WeakMap<SpritePart[], { x: number; y: number; w: number; h: number }>();
export function spriteBBox(parts: SpritePart[]): { x: number; y: number; w: number; h: number } {
  const hit = bboxCache.get(parts);
  if (hit) return hit;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const part of parts) {
    for (const [px, py] of partCorners(part)) {
      x0 = Math.min(x0, px); y0 = Math.min(y0, py);
      x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
  }
  const out = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  bboxCache.set(parts, out);
  return out;
}

const FACING_TYPES = new Set([39, 40, 41, 57, 86]);

export function isMirrored(type: number, variant: number, sub = 0): boolean {
  if (FACING_TYPES.has(type)) return variant !== 0;
  if (type === 38) return variant === 0;
  if (type === 6) return sub !== 0;
  return false;
}

export function spriteImageUrls(): Set<string> {
  const urls = new Set<string>([D + 'sjump2.png']);
  const tables = [SPRITES, ...Object.values(SUBSPRITES)];
  for (const table of tables) {
    for (const parts of Object.values(table)) {
      for (const part of parts) if (part.img) urls.add(part.img);
    }
  }
  return urls;
}
