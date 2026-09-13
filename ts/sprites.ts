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
  img: string; // root-absolute asset URL ('' for editor-only badge parts)
  sx: number; sy: number; w: number; h: number; // source cell, native px
  ox: number; oy: number; // anchor-point offset from object origin, game px
  anchor: Anchor;
  rot?: 0 | 90 | 180 | 270; // clockwise transform about the anchor (TRANS_ROT*)
  flip?: boolean; // horizontal mirror about the anchor, applied before rot
  badge?: { kind: 'ring' | 'tri'; dir?: BadgeDir; fill?: string }; // editor-only movement marker (no image)
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
  // NOTE: type 153 has NO case in callObjectDraw/move/draw — dead in-game.
  // Yellow springs are type 2 with sub%16==2 (springParts); 153 gets no art
  // so the editor shows an honest invisible-marker instead of fake art.
  // Spikes default (var 0): full sheet centered (spike_draw else-branch)
  9: [p(D + 'toge.png', 0, 0, 40, 32, 0, 0, 'center')],
  // Tall bridge: 12 animated 16x24 segments, idle row 0 (thorn_draw)
  4: row(G + 'thashi.png', 0, 0, 16, 24),
  // Bridge: 12 segments of cell (32,0,16,16), idle sag 0 (bridge_draw)
  5: row(G + 'hashi.png', 32, 0, 16, 16),
  // Breakable wall idle: whole 96x96 sheet, center at (x, y-8) (break_draw)
  6: [p(G + 'break.png', 0, 0, 96, 96, 0, -8, 'center')],
  // GH breakable idle (var 0): two 16x16 columns x4 rows, TOP|LEFT (breakable_draw)
  18: breakableParts(0),
  // Swing at rest: pivot + chains + seat (swinging_platform_draw, GH branch)
  3: swingParts(0),
  // GH-native gimmicks: all placed by stock ZONE1ACT, art registered for custom
  16: [p(G + 'shima.png', 0, 0, 64, 32, 0, 0, 'center')], // shima_draw idle (variant 0)
  90: [p(G + 'shima.png', 0, 0, 64, 32, 0, 0, 'center')], // shima2_nflag_draw -> shima_draw
  37: [p(G + 'kageb.png', 0, 0, 16, 64, 0, 0, 'center')], // kageb_draw idle (variant 0)
  38: [p(G + 'hashi.png', 0, 0, 32, 16, 0, 0, 'center')], // bridge_edge_draw (W/3*2 x H of 48x16)
  58: [p(G + 'jyama.png', 0, 0, 48, 32, 0, 0, 'center')], // jyama_draw (whole image)
  42: [p(D + 'item.png', 0, 0, 32, 32, 0, 0, 'center')], // item_nflag_draw idle approx
  43: [p(D + 'item.png', 0, 0, 32, 32, 0, 0, 'center')],
  // Bten switch shares Button art (bonus_draw variant-0 row, sub==1-gated in-game)
  46: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
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

// ── Sub-variant art (sub = ACT byte 6, variant = ACT byte 4) ──

// Springs (type 2): sub/16 orientation (0 up, 1 sideways, 2+ down),
// sub%16==2 yellow art + weak bounce; sideways variant 0 faces right
// (TRANS_ROT90), variant 1 faces left (TRANS_MIRROR_ROT270) — verified
// against spring_move push directions. Idle frame 0 (32x16 cap).
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

// Spikes (type 9): width/orientation by sub, facing/upside-down by variant.
function spikeParts(sub: number, variant: number): SpritePart[] {
  const T = D + 'toge.png';
  const U = variant === 2; // TRANS_ROT180 wrap over floor layouts
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

// Swing (type 3): pivot + sub chain links + seat hanging at rest (straight
// down). Game loop draws links i=1..sub at (x, y+i*16) and the seat at
// (x, y+(sub+1)*16-8); pivot cell (16,16) sits at the origin. GH branch
// cells: pivot (16,16,16,16), chain (16,32,16,16), seat (0,0,48,16).
// variant 1 / sub 5 only reverse the swing direction (same idle art).
function swingParts(sub: number): SpritePart[] {
  const B = D + 'buranko.png';
  const parts: SpritePart[] = [p(B, 16, 16, 16, 16, 0, 0, 'center')];
  const n = Math.max(0, sub);
  for (let i = 1; i <= n; i++) parts.push(p(B, 16, 32, 16, 16, 0, i * 16, 'center'));
  parts.push(p(B, 0, 0, 48, 16, 0, (n + 1) * 16 - 8, 'center'));
  return parts;
}

// Monitor icon rows: sub -> sheet row (item_nflag_ike_itemTable).
// sub 0 (spent/dead) and sub >= 7 draw nothing in-game (null).
// Dud (table row 8) is a half-height box (0,256,32,16) at y+8, no icon.
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

// GH breakable wall (type 18): 2 columns x 4 rows of 16x16 cells.
// Left column cell: sub==0 ? 0 : 1; right column cell: sub==2 ? 2 : 1.
// (breakable_draw; unknown subs fall back to the sub-1 look.)
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

// ── Movement badges (editor-only overlay; the game draws no such marker) ──
//
// Linear shima movers (types 16/90) get a white ring at the platform origin
// plus direction triangles: a single orange triangle for one-way movers
// (switch-rise goes UP, crumble falls DOWN), two triangles for oscillators
// (horizontal: LEFT+RIGHT, vertical: UP+DOWN). The triangle on the side the
// platform moves toward FIRST is orange; the return side is white.
// First-move sides come from the sign of the sin amplitude in
// shima_nflag_move: pos = home + sin(t)*amp with sin rising through 0,
// so a negative amp moves toward the −axis first (sub 1 H → LEFT first,
// sub 2 V → UP first, sub 16 pillar → UP first).
const SHIMA_H_FIRST: Record<number, 'left' | 'right'> = { 1: 'left', 5: 'right', 12: 'right' };
const SHIMA_V_FIRST: Record<number, 'up' | 'down'> = { 2: 'up', 6: 'down', 11: 'up', 16: 'up' };

const BADGE_ORANGE = '#ff8c00';
const BADGE_WHITE = '#ffffff';
const BADGE_GRAY = '#888888';
const BADGE_INK = '#222222';

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
  // Wide triangles: 1.5x base (12px) with 8px height, hugging the center
  // with a 2px gap between the pair.
  // The return-side triangle is 0.75x and gray; the going triangle keeps
  // full size in orange. Dimensions and offsets scale with `scale` so the
  // tall pillar (sub 16, 1.25x) keeps its overlay in proportion.
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

/** Editor-only movement overlay for linear platform movers.
 *  cy centers the badge on the sprite bbox (mid-platform for tall art like
 *  the pillar) so it sits at the platform's pivot instead of the object
 *  origin. The tall pillar (sub 16) uses a 30px ring (1.25x) so the overlay
 *  reads on its tall art; all other shima variants use the standard 24px. */
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

// Sub-indexed art: type -> sub -> parts (motion-only subs fall back to base).
const SUBSPRITES: Record<number, Record<number, SpritePart[]>> = {
  // Monitors 42/43 contents (box + icon overlay; sub 0 spent omitted)
  42: { 1: monitorParts(1), 2: monitorParts(2), 3: monitorParts(3), 4: monitorParts(4), 5: monitorParts(5), 6: monitorParts(6) },
  43: { 1: monitorParts(1), 2: monitorParts(2), 3: monitorParts(3), 4: monitorParts(4), 5: monitorParts(5), 6: monitorParts(6) },
  // Buttons 45/46 art rows (shared bonus_draw)
  45: {
    0: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
    1: [p(D + 'bten.png', 0, 48, 32, 24, 0, 0, 'center')],
    2: [p(D + 'bten.png', 0, 24, 32, 24, 0, 0, 'center')],
    3: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  },
  46: {
    0: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
    1: [p(D + 'bten.png', 0, 48, 32, 24, 0, 0, 'center')],
    2: [p(D + 'bten.png', 0, 24, 32, 24, 0, 0, 'center')],
    3: [p(D + 'bten.png', 0, 0, 32, 24, 0, 0, 'center')],
  },
  // Shima tall pillar (sub 16): top + 6 stacked segments (shima_draw)
  16: {
    16: [
      p(G + 'shima.png', 0, 32, 64, 48, 0, 8, 'center'),
      ...[0, 1, 2, 3, 4, 5].map(i => p(G + 'shima.png', 0, 64, 64, 16, 0, 40 + i * 16, 'center')),
    ],
  },
  90: {
    16: [
      p(G + 'shima.png', 0, 32, 64, 48, 0, 8, 'center'),
      ...[0, 1, 2, 3, 4, 5].map(i => p(G + 'shima.png', 0, 64, 64, 16, 0, 40 + i * 16, 'center')),
    ],
  },
  // Kageb frames (sub -> sheet frame; 0-2 solid, 16-18 decor)
  37: {
    0: [p(G + 'kageb.png', 0, 0, 16, 64, 0, 0, 'center')],
    1: [p(G + 'kageb.png', 16, 0, 16, 64, 0, 0, 'center')],
    2: [p(G + 'kageb.png', 32, 0, 16, 64, 0, 0, 'center')],
    16: [p(G + 'kageb.png', 48, 0, 16, 64, 0, 0, 'center')],
    17: [p(G + 'kageb.png', 64, 0, 16, 64, 0, 0, 'center')],
    18: [p(G + 'kageb.png', 80, 0, 16, 64, 0, 0, 'center')],
  },
  // Breakable GH debris styles (left/right column cells; full 2x4 stack)
  18: {
    0: breakableParts(0),
    1: breakableParts(1),
    2: breakableParts(2),
  },
};
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

/** Full part list for a placed object (with ring expansion + sub/variant art).
 *  Returns null when the game itself draws nothing for the combination
 *  (dead type, spent monitor, out-of-range sub) so callers show a marker. */
export function partsFor(type: number, sub = 0, variant = 0): SpritePart[] | null {
  if (!(type in SPRITES)) return null;
  if (RING_TYPES.has(type)) return ringParts(type, sub);
  if (type === 2) return springParts(sub, variant);
  if (type === 9) return spikeParts(sub, variant);
  if (type === 3) return swingParts(sub);
  if (type === 42 || type === 43) return monitorParts(sub);
  if (type === 45 || type === 46) {
    const table = SUBSPRITES[type];
    return table[sub] ?? table[2]; // unknown subs share the row-24 look
  }
  if (type === 16 || type === 90) {
    // Center the badge on the art bbox so it sits mid-pillar on tall art
    // (pillar spans y −16..128) instead of at the origin.
       const core = sub === 16 ? SUBSPRITES[type][16] : SPRITES[type];
       const bb = spriteBBox(core);
       const badge = moveBadge(type, sub, bb.y + bb.h / 2);
    return badge.length ? [...core, ...badge] : core; // motion subs (1/2/5/6/11/12/3/7/...) share idle art
  }
  if (type === 37) return SUBSPRITES[37][sub] ?? SPRITES[37]; // gate subs -> frame 0
  if (type === 18) return breakableParts(sub);
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
  const urls = new Set<string>([
    // Dynamically resolved by springParts() (sub%16==2) — referenced by no
    // static table since the dead type-153 entry was removed.
    D + 'sjump2.png',
  ]);
  for (const t of Object.keys(SPRITES)) {
    for (const part of SPRITES[Number(t)]) if (part.img) urls.add(part.img);
  }
  for (const t of Object.keys(SUBSPRITES)) {
    for (const s of Object.keys(SUBSPRITES[Number(t)])) {
      for (const part of SUBSPRITES[Number(t)][Number(s)]) if (part.img) urls.add(part.img);
    }
  }
  for (const url of urls) {
    const img = spriteImg(url);
    if (img.complete) continue;
    img.onload = onOneReady;
  }
}

/** Corners of a part in game px relative to the object origin,
 *  with flip/rot applied about the anchor (matches drawParts). */
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

/** Bounding box of parts in game px, relative to object origin. */
export function spriteBBox(parts: SpritePart[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const part of parts) {
    for (const [px, py] of partCorners(part)) {
      x0 = Math.min(x0, px); y0 = Math.min(y0, py);
      x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Draw parts at a game-px origin. k = canvas px per game px (uniform, no stretch).
 *  mirror flips the whole composition about the origin's x (TRANS_MIRROR). */
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
      // Transform about the anchor point (game TRANS_* semantics:
      // TRANS_MIRROR_ROTx mirrors first, then rotates, so the canvas
      // calls go rotate-then-scale — canvas composes right-to-left).
      // NOTE: draw the UNSWAPPED w×h rect in the rotated frame — the
      // canvas rotation itself produces the on-screen h×w extents
      // (matches drawRegion, whose anchor math also uses the unrotated
      // w/h). Pre-swapping rw/rh here would cancel the rotation and
      // draw sideways springs (32×16 cell, rot 90) as a flat 32×16
      // instead of the correct tall 16×32.
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

/** Paint one editor badge part (white ring / direction triangle). */
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
    // Center on the triangle centroid (not the cell middle), so the arrow
    // reads as optically centered in the disc.
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

/** Game-px → canvas-px factor for the current zoom. */
export function spriteScale(cellSize: number): number {
  return cellSize / BLOCK_PX;
}

/** Paint parts at integer scale (default 3x), tightly bbox-fitted.
 *  The canvas is resized to the scaled art; callers display it at
 *  attribute size for true screen pixels (with pixelated rendering).
 *  mirror flips the composition horizontally (R-subtype thumbs). */
export function paintThumb(
  c: CanvasRenderingContext2D,
  parts: SpritePart[],
  scale = 3,
  mirror = false,
): boolean {
  for (const part of parts) {
    if (part.badge) continue; // vector overlay, no image to wait for
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
  // Origin rounded in scaled space so output pixels stay crisp.
  // Mirror flips the whole fitted box (exact for symmetric art, never clips).
  if (mirror) {
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  drawParts(c, parts, Math.round(-bb.x * scale) / scale, Math.round(-bb.y * scale) / scale, scale);
  if (mirror) c.restore();
  return true;
}

// Enemy types whose draw routine mirrors by facing (drawChara / hachi_draw):
// variant byte (objectData[19]) != 0 draws TRANS_MIRRORED in-game.
// Plus static mirror rules verified in draw code:
//   - type 38 (bridge_edge_draw): variant 0 draws TRANS_MIRROR, else normal.
//   - type 6 (break_draw): sub != 0 draws TRANS_MIRROR debris.
const FACING_TYPES = new Set([39, 40, 41, 57, 86]);

/** True when the game draws this object mirrored for the given subtype. */
export function isMirrored(type: number, variant: number, sub = 0): boolean {
  if (FACING_TYPES.has(type)) return variant !== 0;
  if (type === 38) return variant === 0;
  if (type === 6) return sub !== 0;
  return false;
}

const thumbURLCache = new Map<string, string>();

/** Cached dataURL of the 3x composite (for the drag ghost). Null until loaded. */
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
