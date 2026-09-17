"use strict";
(() => {
  // ts/format.ts
  var BLOCK_PX = 256;
  var DEFAULT_COLS = 64;
  var DEFAULT_ROWS = 12;
  var MAX_OBJECTS_PER_TILE = 7;
  var GRID_SNAP = 8;
  var ESSENTIALS = [
    { id: 151, name: "Sonic Placer", desc: "Spawn point for Sonic (required)" },
    { id: 44, name: "Sign Post", desc: "Goal sign post (required)" },
    { id: 36, name: "Star Post", desc: "Checkpoint post" }
  ];
  var RING_LAYOUTS = [
    { id: 0, base: "Ring Row", desc: "Horizontal ring line (+X)" },
    { id: 1, base: "Ring Column", desc: "Vertical ring line (+Y)" },
    { id: 63, base: "Ring Diag -16", desc: "Diagonal ring line (-16/+16)" },
    { id: 64, base: "Ring Diag +16", desc: "Diagonal ring line (+16/+16)" },
    { id: 65, base: "Ring Diag +32", desc: "Diagonal ring line (+32/+32)" },
    { id: 66, base: "Ring Horiz 16", desc: "Horizontal ring line 16px steps" },
    { id: 67, base: "Ring Horiz 32", desc: "Horizontal ring line 32px steps" },
    { id: 68, base: "Ring Vert 16", desc: "Vertical ring line 16px steps" },
    { id: 69, base: "Ring Vert 32", desc: "Vertical ring line 32px steps" }
  ];
  var RING_TYPES = [];
  for (let li = 0; li < RING_LAYOUTS.length; li++) {
    const layout = RING_LAYOUTS[li];
    for (let n = 1; n <= 7; n++) {
      if (n === 1 && li !== 0) continue;
      RING_TYPES.push({
        id: layout.id,
        name: n === 1 ? layout.base : `${layout.base} \xD7${n}`,
        desc: `${layout.desc}, ${n} ring${n === 1 ? "" : "s"}`,
        isRing: true,
        ringLayout: layout.id,
        sub: n - 1
      });
    }
  }
  var OBJECTS = [
    // Springs (type 2): sub/16 orientation (0 up, 1 sideways, 2+ down),
    // sub%16==2 yellow art + weak bounce; sideways facing by variant.
    // Stock GH: yellow-up x15, red-side-R (16,1) x6.
    // Tray order is flat but grouped by family: all red subtypes, then
    // all yellow subtypes (up -> sideways R/L -> down).
    { id: 2, name: "Red Spring", desc: "Red spring pad (bounces up)", sub: 0 },
    { id: 2, name: "Red Spring R", desc: "Sideways red spring (faces right)", variant: 0, sub: 16 },
    { id: 2, name: "Red Spring L", desc: "Sideways red spring (faces left, stock GH)", variant: 1, sub: 16 },
    { id: 2, name: "Red Spring Down", desc: "Ceiling red spring (bounces down)", sub: 32 },
    { id: 2, name: "Yellow Spring", desc: "Yellow spring pad, weak bounce (stock GH)", sub: 2 },
    { id: 2, name: "Yellow Spring R", desc: "Sideways yellow spring, weak (faces right)", variant: 0, sub: 18 },
    { id: 2, name: "Yellow Spring L", desc: "Sideways yellow spring, weak (faces left)", variant: 1, sub: 18 },
    { id: 2, name: "Yellow Spring Down", desc: "Ceiling yellow spring, weak", sub: 34 },
    // Spikes (type 9): width/orientation by sub; variant 2 = ceiling (ROT180),
    // wall subs (16/18/82) face by variant 0/1. Stock GH: 0/32/48/64 + one 16.
    // Tray order is flat, sorted by spike count ascending (1 -> 3 -> 5 -> 6),
    // then by gap ascending (contiguous sheet before spaced columns; the
    // ceiling twin sits right after its floor twin, wall singles before
    // full-wall sheets). Counts: sub 32 / 82 = 1 spike, sub 48 = 3 spikes
    // at 24px spacing, sub 0 / 16 / 18 = 5 contiguous spikes, sub 64 =
    // 6 spikes at 24px spacing (see spike_draw in MainCanvas.as).
    { id: 9, name: "Spikes Narrow", desc: "Single-column spikes (stock GH)", sub: 32 },
    { id: 9, name: "Spikes Single L", desc: "Single wall spike (faces left)", variant: 0, sub: 82 },
    { id: 9, name: "Spikes Single R", desc: "Single wall spike (faces right)", variant: 1, sub: 82 },
    { id: 9, name: "Spikes Triple", desc: "Triple spikes (stock GH)", sub: 48 },
    { id: 9, name: "Spikes", desc: "Spike trap (floor, stock GH)", sub: 0 },
    { id: 9, name: "Spikes Ceiling", desc: "Spike trap (ceiling, variant 2)", variant: 2, sub: 0 },
    { id: 9, name: "Spikes Wall L", desc: "Wall spikes (faces left, stock GH)", variant: 0, sub: 16 },
    { id: 9, name: "Spikes Wall R", desc: "Wall spikes (faces right)", variant: 1, sub: 16 },
    { id: 9, name: "Spikes Wall 18", desc: "Sliding wall spikes, sub 18 (extends on a timer)", variant: 0, sub: 18 },
    { id: 9, name: "Spikes Wide", desc: "Six-column spikes (stock GH)", sub: 64 },
    // Switch (type 15): sub = switchflag index it drives. No stock GH usage.
    { id: 15, name: "Switch 0", desc: "Switch driving flag 0", sub: 0 },
    { id: 15, name: "Switch 1", desc: "Switch driving flag 1", sub: 1 },
    { id: 15, name: "Switch 2", desc: "Switch driving flag 2", sub: 2 },
    // Buttons (type 45): sub selects art row (0/3 row 0, 1 row 2, else row 1).
    // Invisible in-game until touched; editor previews idle art. Stock GH: 1/2/3.
    { id: 45, name: "Button 1", desc: "Button sub 1 (stock GH; shows when touched)", sub: 1 },
    { id: 45, name: "Button 2", desc: "Button sub 2 (stock GH; shows when touched)", sub: 2 },
    { id: 45, name: "Button 3", desc: "Button sub 3 (stock GH; shows when touched)", sub: 3 },
    // Monitors (type 43 = stock GH flavor): sub = contents
    // (1 dud, 2 1UP, 3 speed, 4 shield, 5 invinc, 6 rings; 0 dead, 7+ invisible).
    { id: 43, name: "Monitor Dud", desc: "Empty monitor (stock art row 0)", sub: 1 },
    { id: 43, name: "Monitor 1UP", desc: "Extra-life monitor (stock GH)", sub: 2 },
    { id: 43, name: "Monitor Speed", desc: "Speed-shoes monitor (stock GH)", sub: 3 },
    { id: 43, name: "Monitor Shield", desc: "Shield monitor (stock GH)", sub: 4 },
    { id: 43, name: "Monitor Invinc", desc: "Invincibility monitor (stock GH)", sub: 5 },
    { id: 43, name: "Monitor Rings", desc: "10-rings monitor (stock GH)", sub: 6 },
    // Tall bridge (type 4, stock sub 16) / standard bridge (type 5, stock sub 12)
    { id: 4, name: "Tall Bridge", desc: "Tall bridge / pole (stock GH sub 16)", sub: 16 },
    { id: 5, name: "Bridge", desc: "Standard bridge (stock GH sub 12)", sub: 12 },
    // Bridge edge (type 38, stock sub 3): variant 0 mirrored, else normal.
    { id: 38, name: "Bridge Edge L", desc: "Bridge end, mirrored (stock GH)", variant: 0, mirror: true, sub: 3 },
    { id: 38, name: "Bridge Edge R", desc: "Bridge end, normal (stock GH)", variant: 1, sub: 3 },
    // Breakable wall (type 6): sub != 0 mirrors debris. Stock: (0,0) + (1,1).
    { id: 6, name: "Breakable Wall", desc: "Breakable wall segment (stock GH)", sub: 0 },
    { id: 6, name: "Breakable Wall M", desc: "Breakable wall, mirrored debris (stock GH)", variant: 1, mirror: true, sub: 1 },
    // GH breakable (type 18): sub 0/1/2 visual styles, all in stock GH.
    { id: 18, name: "Break Wall A", desc: "GH breakable wall, style A (stock GH)", sub: 0 },
    { id: 18, name: "Break Wall B", desc: "GH breakable wall, style B (stock GH)", sub: 1 },
    { id: 18, name: "Break Wall C", desc: "GH breakable wall, style C (stock GH)", sub: 2 },
    // Swing (type 3): sub = chain length - 1 (stock 6/7/8); sub 5 or
    // variant 1 reverses swing direction (same idle art).
    { id: 3, name: "Swing S", desc: "Swinging platform, short (stock GH sub 6)", sub: 6 },
    { id: 3, name: "Swing M", desc: "Swinging platform, medium (stock GH sub 7)", sub: 7 },
    { id: 3, name: "Swing L", desc: "Swinging platform, long (stock GH sub 8)", sub: 8 },
    { id: 3, name: "Swing Reverse", desc: "Short swing, reversed direction (variant 1)", variant: 1, sub: 6 },
    // Shima platforms (type 16): motion by sub (same idle art except pillar).
    // Stock 16: 0/1/2/3/5/6. Pillar art only for sub 16.
    { id: 16, name: "Shima Platform", desc: "GH floating platform, static", sub: 0 },
    { id: 16, name: "Shima Mover H", desc: "Platform moving horizontally (first LEFT, stock GH)", sub: 1 },
    { id: 16, name: "Shima Mover V", desc: "Platform moving vertically (first UP, stock GH)", sub: 2 },
    { id: 16, name: "Shima Crumble", desc: "Crumbling platform (falls DOWN, stock GH)", sub: 3 },
    { id: 16, name: "Shima Pillar", desc: "Tall pillar platform (bobs vertically, sub 16 art)", sub: 16 },
    { id: 16, name: "Shima Switch", desc: "Switch-rise platform (rises UP, flag 128)", sub: 7 },
    // Kageb blocks (type 37): sub 0/1/2 solid frames, 16/17/18 decor frames.
    // All six in stock GH; other subs < 16 fall back to frame 0 art.
    { id: 37, name: "Kageb A", desc: "GH block, solid frame 0 (stock GH)", sub: 0 },
    { id: 37, name: "Kageb B", desc: "GH block, solid frame 1 (stock GH)", sub: 1 },
    { id: 37, name: "Kageb C", desc: "GH block, solid frame 2 (stock GH)", sub: 2 },
    { id: 37, name: "Kageb Decor A", desc: "GH block, decor frame 3 (stock GH)", sub: 16 },
    { id: 37, name: "Kageb Decor B", desc: "GH block, decor frame 4 (stock GH)", sub: 17 },
    { id: 37, name: "Kageb Decor C", desc: "GH block, decor frame 5 (stock GH)", sub: 18 },
    { id: 58, name: "Jyama", desc: "Green Hill gimmick" }
  ];
  var ENEMIES = [
    { id: 41, name: "Musi", desc: "Bug badnik (crawls left)" },
    { id: 41, name: "Musi R", desc: "Bug badnik (crawls right)", variant: 1, mirror: true },
    { id: 40, name: "Hachi", desc: "Bee badnik (patrols left)" },
    { id: 40, name: "Hachi R", desc: "Bee badnik (patrols right)", variant: 1, mirror: true },
    { id: 86, name: "Fish Chopper", desc: "Chopper fish (jumps from water)" },
    { id: 39, name: "Kamere", desc: "Chameleon badnik (faces left)" },
    { id: 39, name: "Kamere R", desc: "Chameleon badnik (faces right)", variant: 1, mirror: true },
    { id: 39, name: "Kamere Turret", desc: "Chameleon turret, stationary (faces left)", sub: 1 },
    { id: 39, name: "Kamere Turret R", desc: "Chameleon turret, stationary (faces right)", variant: 1, mirror: true, sub: 1 },
    { id: 57, name: "Kani", desc: "Crab badnik (walks left)" },
    { id: 57, name: "Kani R", desc: "Crab badnik (walks right)", variant: 1, mirror: true }
  ];
  var SHEET_SIZE = 4096;
  var SHEET_COLS = 16;
  var SHEET_BLOCK_SIZE = SHEET_SIZE / SHEET_COLS;
  var TOTAL_BLOCKS = 256;
  var USED_BLOCKS = 135;
  function blockSheetXY(id) {
    return {
      x: id % SHEET_COLS * SHEET_BLOCK_SIZE,
      y: Math.floor(id / SHEET_COLS) * SHEET_BLOCK_SIZE
    };
  }
  function encodeBin(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const out = [];
    function pushU32(v) {
      out.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
    }
    pushU32(4);
    for (let layer = 0; layer < 4; layer++) {
      pushU32(rows);
      for (let r = 0; r < rows; r++) {
        pushU32(cols);
        for (let c = 0; c < cols; c++) {
          pushU32(grid[r][c]);
        }
      }
    }
    return out;
  }
  function encodeAct(objects) {
    const sorted = [...objects].sort((a, b) => a.x - b.x || a.y - b.y);
    const entries = [];
    for (const obj of sorted) {
      entries.push(
        obj.x >>> 8 & 255,
        obj.x & 255,
        obj.y >>> 8 & 255,
        obj.y & 255,
        obj.variant & 255,
        obj.type & 255,
        obj.sub & 255
      );
    }
    const tableLen = entries.length;
    const out = [];
    for (let t = 0; t < 4; t++) {
      out.push(tableLen >>> 8 & 255, tableLen & 255);
    }
    for (let t = 0; t < 4; t++) {
      for (const b of entries) out.push(b);
    }
    return out;
  }
  function toCSV(binBytes, actBytes) {
    const all = binBytes.concat(actBytes);
    return all.join(",");
  }
  function isRingType(type) {
    return type <= 1 || type >= 63 && type <= 69;
  }
  function objectTileCost(type, sub) {
    return isRingType(type) ? 1 + sub : 1;
  }
  function countObjectsInTile(objects, tileCol, tileRow) {
    let count = 0;
    for (const obj of objects) {
      const tc = Math.floor(obj.x / BLOCK_PX);
      const tr = Math.floor(obj.y / BLOCK_PX);
      if (tc === tileCol && tr === tileRow) {
        count += objectTileCost(obj.type, obj.sub);
      }
    }
    return count;
  }
  function snap8(v) {
    return Math.round(v / GRID_SNAP) * GRID_SNAP;
  }
  function pixelToTile(px) {
    return Math.floor(px / BLOCK_PX);
  }

  // ts/state.ts
  var S = {
    grid: [],
    objects: [],
    activeTab: "tiles",
    selectedTile: 1,
    selectedObj: null,
    // Chosen on the "Start a new level" screen; used for the save filename.
    levelName: "The Guide Zone",
    zoom: 2,
    spaceHeld: false,
    selectedObjIdx: -1,
    // Selected tile cell (block coords, -1 when nothing selected). Clicking a
    // filled cell selects it: draw() outlines it + paints a remove badge.
    selectedTileBx: -1,
    selectedTileBy: -1,
    dragObj: null,
    dragOffX: 0,
    dragOffY: 0,
    // Palette drag (started from thumbnail, ends on canvas)
    paletteDrag: false,
    paletteDragTile: 0,
    paletteDragDef: null,
    // Palette-drag drop preview (snapped world px, only live while the cursor
    // is over the canvas itself — canvas-drawn, no HTML duplication)
    previewPX: 0,
    previewPY: 0,
    previewOnCanvas: false,
    // Hover highlight (tile cell under the cursor, -1 when outside grid)
    hoverBx: -1,
    hoverBy: -1,
    gloweyImg: null,
    // Pan state
    panning: false,
    panStartX: 0,
    panStartY: 0,
    panStartSX: 0,
    panStartSY: 0,
    // DOM refs (populated in boot)
    shadow: null,
    canvas: null,
    ctx: null,
    spritesheetImg: null,
    thumbstrip: null,
    descEl: null,
    counterEl: null,
    canvasWrap: null,
    ghostEl: null
  };
  function cellSize() {
    return Math.round(128 * S.zoom);
  }
  function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    S.grid = [];
    for (let r = 0; r < rows; r++) S.grid.push(new Array(cols).fill(0));
    S.objects = [];
    S.selectedObjIdx = -1;
    S.selectedTileBx = -1;
    S.selectedTileBy = -1;
  }
  function inGrid(bx, by) {
    return bx >= 0 && bx < S.grid[0].length && by >= 0 && by < S.grid.length;
  }
  function updateDesc(text) {
    if (S.descEl) S.descEl.textContent = text;
  }
  function canvasToWorld(e) {
    const rect = S.canvas.getBoundingClientRect();
    const cs = cellSize();
    const sx = S.canvasWrap ? S.canvasWrap.scrollLeft : 0;
    const sy = S.canvasWrap ? S.canvasWrap.scrollTop : 0;
    const mx = e.clientX - rect.left + sx;
    const my = e.clientY - rect.top + sy;
    return {
      bx: Math.floor(mx / cs),
      by: Math.floor(my / cs),
      px: Math.floor(mx / cs * BLOCK_PX),
      py: Math.floor(my / cs * BLOCK_PX),
      mx,
      my
    };
  }
  function defsForTab(tab) {
    if (tab === "objects") return OBJECTS;
    if (tab === "rings") return RING_TYPES;
    if (tab === "enemies") return ENEMIES;
    return ESSENTIALS;
  }
  function objectsInTile(tc, tr) {
    return countObjectsInTile(S.objects, tc, tr);
  }
  function totalObjects() {
    return S.objects.length;
  }
  function countPlacedTiles() {
    let c = 0;
    for (const row2 of S.grid) for (const id of row2) if (id > 0) c++;
    return c;
  }
  var defCache = /* @__PURE__ */ new Map();
  function findDef(typeId, variant, sub) {
    const key = `${typeId}|${variant ?? ""}|${sub ?? ""}`;
    const hit = defCache.get(key);
    if (hit !== void 0) return hit;
    const out = findDefUncached(typeId, variant, sub);
    defCache.set(key, out);
    return out;
  }
  function findDefUncached(typeId, variant, sub) {
    const pools = [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES];
    if (variant !== void 0 || sub !== void 0) {
      for (const arr of pools)
        for (const d of arr)
          if (d.id === typeId && (variant === void 0 || (d.variant ?? 0) === variant) && (sub === void 0 || (d.sub ?? 0) === sub)) return d;
    }
    for (const arr of pools)
      for (const d of arr) if (d.id === typeId) return d;
    return null;
  }

  // ts/ui.ts
  var EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; margin: 0; padding: 0; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  margin: 0; padding: 8px; gap: 8px;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: linear-gradient(#ffffff, #e8e8e8); overflow: hidden; user-select: none;
  border: 1px solid #c9c9c9; border-top: none; border-radius: 0 0 10px 10px; }

/* \u2500\u2500 top bar: flush header band inside the canvas container \u2014 full-bleed,
   top edge flush with the panel top, bottom border doubling as the divider
   over the canvas \u2500\u2500 */
.topbar { display: flex; align-items: center; justify-content: space-between;
  margin: 0; padding: 4px 10px;
  background: linear-gradient(#f4f4f4, #d9d9d9);
  border: none; border-bottom: 1px solid #c9c9c9; border-radius: 7px 7px 0 0;
  color: #555; flex-shrink: 0; }
.topbar-l, .topbar-r { display: flex; align-items: center; gap: 6px; }
.topbar label { font-size: 12px; }
.btn { padding: 1px 10px; border: 1px solid #d99a3d; border-radius: 10px;
  background: linear-gradient(#fff8ea, #ffe2b0); color: #6b4a00;
  cursor: pointer; font-size: 11px; font-weight: bold; font-family: inherit; }
.btn-active { background: linear-gradient(#ffb85e, #ff9426); border-color: #d97a1a; color: #fff; }
.btn-clear { width: 20px; height: 20px; padding: 0; flex-shrink: 0;
  border-radius: 50%; border: none; position: relative;
  background: #999999; display: inline-block; }
.btn-clear svg { display: block; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%); }
.counter { background: #ffe9c0; border: 1px solid #d99a3d; border-radius: 8px;
  padding: 0 8px; font-weight: bold; color: #6b4a00; }
.topbar-r > span:first-child { color: #777; }

/* \u2500\u2500 main split: canvas on top, tabs+options below \u2500\u2500 */
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; }

/* \u2500\u2500 canvas area: white rounded panel with padding \u2500\u2500 */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; padding: 0; }
.canvas-wrap { flex: 1; overflow: auto; background: #fff; min-height: 0;
  border-radius: 0 0 7px 7px;
  scrollbar-color: #c2c2c2 #f0f0f0; scrollbar-width: thin; }
/* Grid-sized scroll space; the canvas itself is viewport-sized and sticky
   (see resizeCanvas) so the backing store never exceeds the visible area. */
.canvas-inner { position: relative; }
canvas.display { display: block; cursor: crosshair; border: none;
  position: sticky; top: 0; left: 0; }
.canvas-wrap::-webkit-scrollbar { width: 10px; height: 10px; }
.canvas-wrap::-webkit-scrollbar-track { background: #f0f0f0; }
.canvas-wrap::-webkit-scrollbar-thumb { background: #c2c2c2; border-radius: 5px;
  border: 2px solid #f0f0f0; }

/* \u2500\u2500 bottom: tabs+strip panel + options box (30% height) \u2500\u2500 */
.bottom { display: flex; height: 25%; min-height: 170px; max-height: 750px; gap: 8px; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; }
.tabs { display: flex; gap: 4px; flex-shrink: 0; padding: 0 8px;
  background: linear-gradient(#ffcf90, #ffa13c); border-radius: 7px 7px 0 0; }
.tab { padding: 4px 12px; border: none; border-radius: 6px 6px 0 0;
  background: transparent; color: #3d2c00; cursor: pointer;
  font-size: 12px; font-weight: bold; font-family: inherit; }
.tab:hover { background: rgba(255,255,255,0.35); }
.tab-active, .tab-active:hover { background: linear-gradient(#f4f4f4, #d9d9d9); }
.thumbstrip { flex: 1; display: flex; gap: 4px; padding: 6px;
  background: #f0f0f0; overflow-x: auto; overflow-y: hidden; align-items: stretch; }
.thumb { height: 100%; aspect-ratio: 1; border: none; border-radius: 10px; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
/* Tray art lives in an 80%-of-box bounding box: natural size, shrinking
   only when larger than the box (tiles and objects alike). */
.thumb canvas { display: block; width: auto; height: auto; max-width: 80%; max-height: 80%;
  image-rendering: pixelated; image-rendering: crisp-edges; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 0 0 12px;
  background: linear-gradient(#ffffff, #e9e9e9);
  border: 1px solid #c4c4c4; border-radius: 10px;
  gap: 10px; max-width: 150px; }
.panel-right h4 { margin: 0; padding: 8px 14px 6px; font-size: 14px; color: #333;
  text-align: left; background: linear-gradient(#f4f4f4, #d9d9d9);
  border-radius: 9px 9px 0 0; border-bottom: 1px solid #c4c4c4; }
/* Options buttons: glossy site lozenge in pure CSS \u2014 no image assets.
   Tuned to the reference render: pale flash top (#ffedbe) falling to deep
   orange (#ffa028) with the turn at 45%, darker #e8932b rim, 8px corners,
   inset top highlight for the gloss, 13px near-black label. Hover lifts the
   whole ramp. Markup stays <a class="act-btn"><span>\u2026</span></a> so the
   [data-action] wiring is untouched. Buttons carry their own side margins
   so the header divider runs full-bleed edge to edge. */
.act-btn { display: block; height: 28px; margin: 0 14px;
  background: linear-gradient(to bottom, #ffedbe 0%, #ffc46a 45%, #ffa028 100%);
  border: 1px solid #e8932b; border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
  color: #333; font-weight: bold; font-size: 13px; font-family: inherit;
  text-decoration: none; cursor: pointer; }
.act-btn span { display: flex; align-items: center; justify-content: center;
  height: 100%; text-align: center;
  /* Measured against a screenshot: the flex-centered label sits ~0.5px low,
     so nudge up half a pixel. */
  transform: translateY(-0.5px); }
.act-btn:link, .act-btn:active, .act-btn:visited { color: #333; text-decoration: none; font-weight: bold; }
.act-btn:hover { background: linear-gradient(to bottom, #fff6dd 0%, #ffd38c 45%, #ffb14e 100%);
  color: #333; outline: none; }

/* \u2500\u2500 bottom bar: uncolored, site lozenge2 sliding doors verbatim \u2500\u2500 */
.bottombar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 2px; background: transparent; color: #555; flex-shrink: 0; }
.bottombar-l { display: flex; gap: 0; }
/* Exact replica of a.lozenge2 (css/playsega.css) for the footer buttons:
   grey sliding doors with the real GIFs. Root-absolute paths since shadow
   <style> URLs resolve against the document base. Only addition vs site:
   border:none (these are <button>s, not <a>s). Markup carries the same
   inner <span>; [data-action] wiring is untouched. */
.btm-btn { background: transparent url('/images/bg_button_grey_end.gif') no-repeat scroll top right;
  color: #fff; display: inline-block; font-weight: bold; height: 22px;
  margin-right: 6px; padding: 0 18px 0 0; border: none; text-decoration: none;
  cursor: pointer; font-size: 12px; font-family: inherit; }
.btm-btn span { background: transparent url('/images/bg_button_grey_span.gif') no-repeat;
  display: block; line-height: 11px; padding: 5px 0 6px 16px; }
.btm-btn:link, .btm-btn:active, .btm-btn:visited { color: #fff; text-decoration: none; font-weight: bold; }
.btm-btn:hover { background-position: bottom right; color: #fff; outline: none; }
.btm-btn:hover span { background-position: bottom left; }

/* \u2500\u2500 floating ghost \u2500\u2500 */
.ghost { display: none; position: fixed; pointer-events: none; z-index: 9999;
  opacity: 0.7; border: 2px dashed #fff; background-color: rgba(0,0,0,0.3);
  image-rendering: pixelated; }
.ghost.visible { display: block; }

/* \u2500\u2500 object tooltip (replaces native title) \u2014 1:1 with reference \u2500\u2500
   White up-top with blue text, thin bottom gray gradient (same as
   Options header), no border, soft bottom shadow, pointer at 30% from
   left with a small left gap. Hidden by default; toggled .visible by
   JS after a hover delay. Fixed so it escapes the thumbstrip's overflow
   clip. Arrow is a downward-pointing white triangle, not a centered
   diamond. */
.obj-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: 250px;
  background: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease;
  /* single drop-shadow that wraps bubble + diamond stem as one shape,
     so there's no seam between the gray footer and the point */
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22)) drop-shadow(0 2px 4px rgba(0,0,0,0.16));
}
.obj-tooltip.visible { opacity: 1; visibility: visible; }
.obj-tooltip .tip-text {
  padding: 8px 14px 7px;
  color: #1767c9;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  line-height: 14px;
  font-weight: 700;
  text-align: left;
  white-space: normal;
  word-wrap: break-word;
  background: #ffffff;
  border-radius: 6px 6px 0 0;
}
.obj-tooltip .tip-bottom {
  height: 18px;
  background: linear-gradient(#d9d9d9, #f4f4f4);
  border-radius: 0 0 6px 6px;
}
.obj-tooltip::after {
  content: "";
  position: absolute;
  /* start of tooltip with a small left gap; offset keeps the stem glued
     to the thumb's 30% point when the bubble is viewport-clamped.
     Flat-top triangle flush to the gray footer so the gradient flows
     into the point with no diamond notch or seam. */
  left: calc(22px + var(--tip-arrow-offset, 0px));
  bottom: -8px;
  width: 0;
  height: 0;
  background: transparent;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 8px solid #f4f4f4;
  transform: translateX(-50%);
  box-shadow: none;
}

/* \u2500\u2500 start screen: opaque overlay so the editor is not visible behind \u2500\u2500
   White card, blue headings, pale input, green pill button, Sonic right.
   Root-absolute img path since shadow URLs resolve against document base. */
.start-overlay { position: absolute; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: #fff; border-radius: 0 0 10px 10px; }
.start-overlay.hidden { display: none; }
.start-card { position: relative; background: #fff; border: 1px solid #b5b5b5;
  border-radius: 10px; padding: 12px 12px 24px; width: 420px;
  max-width: calc(100% - 32px); min-height: 330px; text-align: left; }
/* Pinned bottom-right, out of flow: zero reflow when the PNG arrives. */
.start-sonic { position: absolute; right: 16px; bottom: 12px; height: 224px; width: auto; }
.start-card h2 { color: #1767c9; font-size: 26px; font-weight: bold;
  margin: 0 0 4px; }
.start-card p { color: #1767c9; font-size: 15px; font-weight: bold;
  line-height: 1.35; margin: 0 0 34px; }
.start-card label { display: block; color: #222; font-size: 16px;
  font-weight: bold; margin: 0 190px 8px 0; }
.start-row { display: block; margin-right: 190px; }
.start-name { display: block; width: 125%; padding: 3px 8px; font-size: 11px;
  font-family: inherit; color: #333; background: #e9e9e9;
  border: 1px solid #c4c4c4; border-radius: 3px; outline: none; }
.start-name:focus { border-color: #1767c9; background: #fff; }
.start-go { flex-shrink: 0; margin-top: 22px; padding: 4px 20px; border: 1px solid #8ab53f;
  border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold;
  font-family: inherit; color: #3f5a12;
  background: linear-gradient(to bottom, #d3ec9a 0%, #b3d666 50%, #9ecf4e 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
.start-go:hover { background: linear-gradient(to bottom, #e0f3b0 0%, #c0e07c 50%, #abdb5c 100%); }
*/

/* \u2500\u2500 test mode: persistent player overlaying the whole editor space \u2500\u2500
   The player is created once at boot and kept alive (muted) behind the
   editor so Test opens warm. .warm renders it with real dimensions but
   invisible (display:none would leave Ruffle with nothing to boot into);
   .active shows it. No synthetic clicks \u2014 the user clicks the title. */
.editor.hidden { display: none; }
.testmode { display: none; width: 100%; height: 100%; margin: 0; padding: 0;
  position: absolute; inset: 0; z-index: 5; background: #000; overflow: hidden;
  border-radius: 0 0 10px 10px; }
.testmode.active { display: flex; align-items: center; justify-content: center;
  visibility: visible; opacity: 1; pointer-events: auto; }
/* .warm must stay truly invisible even if Ruffle forces visibility:visible
   inside its own shadow DOM \u2014 opacity:0 on the parent cannot be overridden
   by children, unlike visibility. Pointer events fully off so the overlay
   never intercepts editor clicks while warming. */
.testmode.warm { display: flex; align-items: center; justify-content: center;
  visibility: hidden; opacity: 0 !important; pointer-events: none !important; }
.testmode.warm * { pointer-events: none !important; }
.ruffle-holder { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; background: #000; }
.ruffle-holder ruffle-player { display: block; width: 100%; height: 100%; background: #000; }
/* Exact replica of a.lozenge1 (css/playsega.css) \u2014 the orange "Sign up!"
   sliding doors with the real GIFs. Root-absolute paths since shadow
   <style> URLs resolve against the document base. Only addition vs site:
   border:none + positioning (this is a <button> pinned top-left, not an <a>).
   Markup carries the same inner <span>; [data-action] wiring is untouched. */
.stop-test { background: transparent url('/images/bg_button_a.gif') no-repeat scroll top right;
  color: #4c4c4c; display: block; float: left; font-weight: bold; height: 22px;
  margin-right: 6px; padding: 0 18px 0 0; border: none; text-decoration: none;
  cursor: pointer; font-size: 12px; font-family: inherit;
  position: absolute; top: 8px; left: 8px; z-index: 10; }
.stop-test span { background: transparent url('/images/bg_button_span.gif') no-repeat;
  display: block; line-height: 11px; padding: 5px 0 6px 16px; }
.stop-test:link, .stop-test:active, .stop-test:visited { color: #4c4c4c; text-decoration: none; font-weight: bold; }
.stop-test:hover { background-position: bottom right; color: #4c4c4c; outline: none; }
.stop-test:hover span { background-position: bottom left; }
`;
  var EDITOR_HTML = `
<div class="editor">
  <div class="main">
    <div class="canvas-area">
      <div class="topbar">
        <div class="topbar-l">
          <label>Zoom:</label>
          <button class="btn btn-active" data-zoom="2">100%</button>
          <button class="btn" data-zoom="1">50%</button>
          <button class="btn" data-zoom="0.5">25%</button>
        </div>
        <div class="topbar-r">
          <span>Object Counter:</span>
          <span class="counter">0</span>
          <button class="btn btn-clear" title="Clear entire level"><svg viewBox="0 0 12 12" width="12" height="12"><line x1="3" y1="3" x2="9" y2="9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-inner"><canvas class="display"></canvas></div>
      </div>
    </div>

    <div class="bottom">
      <div class="panel-left">
        <div class="tabs">
          <button class="tab tab-active" data-tab="tiles">Tiles</button>
          <button class="tab" data-tab="objects">Objects</button>
          <button class="tab" data-tab="rings">Rings</button>
          <button class="tab" data-tab="enemies">Enemies</button>
          <button class="tab" data-tab="essentials">Essentials</button>
        </div>
        <div class="thumbstrip"></div>
      </div>
      <div class="panel-right">
        <h4>Options</h4>
        <a class="act-btn" data-action="test"><span>Test Level</span></a>
        <a class="act-btn" data-action="save"><span>Save</span></a>
        <a class="act-btn" data-action="fullscreen"><span>Go Fullscreen</span></a>
      </div>
    </div>
  </div>

  <div class="bottombar">
    <div class="bottombar-l">
      <button class="btm-btn" data-action="mylevels"><span>My Levels</span></button>
      <button class="btm-btn" data-action="alllevels"><span>All Levels</span></button>
    </div>
    <button class="btm-btn" data-action="share"><span>SHARE</span></button>
  </div>

  <div class="ghost" id="ghost"></div>
</div>

<div class="testmode">
  <div class="ruffle-holder"></div>
  <button class="stop-test" data-action="stoptest"><span>Stop testing</span></button>
</div>

<div class="start-overlay">
  <div class="start-card">
    <h2>Start a new level</h2>
    <p>Ready to start creating a new level? Choose a level name to get started! Be creative!</p>
    <label for="start-name">Level Name</label>
    <div class="start-row">
      <input class="start-name" id="start-name" type="text" value="The Guide Zone" maxlength="60" />
      <button class="start-go" data-action="startcreating">Start creating...</button>
    </div>
    <img class="start-sonic" src="/editors/assets/sonic.png" alt="Sonic" width="1945" height="3010" />
  </div>
</div>
`;

  // ts/sprites.ts
  var D = "/games/swf/52/res/images/default/";
  var G = "/games/swf/52/res/images/zone_greenhill/";
  function p(img, sx, sy, w, h, ox, oy, anchor, rot, flip) {
    const part = { img, sx, sy, w, h, ox, oy, anchor };
    if (rot) part.rot = rot;
    if (flip) part.flip = flip;
    return part;
  }
  function row(img, sx, sy, w, h) {
    const parts = [];
    for (let i = 0; i < 12; i++) parts.push(p(img, sx, sy, w, h, -96 + i * 16, 0, "center"));
    return parts;
  }
  var SPRITES = {
    // Essentials
    151: [p(D + "sonic.png", 0, 0, 29, 40, 0, 0, "center")],
    // framedata[151][0]
    44: [p(D + "gole.png", 0, 0, 48, 48, 0, 10, "center")],
    // goal_draw idle
    // Star post idle (objectData[5]==0): top + base (save_draw)
    36: [
      p(D + "save.png", 0, 16, 16, 16, 0, -36, "center"),
      p(D + "save.png", 0, 32, 16, 48, 0, -4, "center")
    ],
    // Rings share the type-0 image (ring_draw); fan-out added in ringParts()
    0: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    1: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    63: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    64: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    65: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    66: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    67: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    68: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    69: [p(D + "ring.png", 0, 0, 16, 16, 0, 0, "center")],
    // Giant ring has NO draw routine in-game; show its registered art so the
    // object can still be seen and grabbed in the editor.
    47: [p(D + "ring_large.png", 0, 0, 64, 256, 0, 0, "center")],
    // Springs idle (spring_draw case 0, frame 0): BOTTOM|HCENTER at (x, y+8)
    2: [p(D + "sjump.png", 0, 0, 32, 16, 0, 8, "bottomcenter")],
    // framedata[2][0]
    // NOTE: type 153 has NO case in callObjectDraw/move/draw — dead in-game.
    // Yellow springs are type 2 with sub%16==2 (springParts); 153 gets no art
    // so the editor shows an honest invisible-marker instead of fake art.
    // Spikes default (var 0): full sheet centered (spike_draw else-branch)
    9: [p(D + "toge.png", 0, 0, 40, 32, 0, 0, "center")],
    // Tall bridge: 12 animated 16x24 segments, idle row 0 (thorn_draw)
    4: row(G + "thashi.png", 0, 0, 16, 24),
    // Bridge: 12 segments of cell (32,0,16,16), idle sag 0 (bridge_draw)
    5: row(G + "hashi.png", 32, 0, 16, 16),
    // Breakable wall idle: whole 96x96 sheet, center at (x, y-8) (break_draw)
    6: [p(G + "break.png", 0, 0, 96, 96, 0, -8, "center")],
    // GH breakable idle (var 0): two 16x16 columns x4 rows, TOP|LEFT (breakable_draw)
    18: breakableParts(0),
    // Swing at rest: pivot + chains + seat (swinging_platform_draw, GH branch)
    3: swingParts(0),
    // GH-native gimmicks: all placed by stock ZONE1ACT, art registered for custom
    16: [p(G + "shima.png", 0, 0, 64, 32, 0, 0, "center")],
    // shima_draw idle (variant 0)
    90: [p(G + "shima.png", 0, 0, 64, 32, 0, 0, "center")],
    // shima2_nflag_draw -> shima_draw
    37: [p(G + "kageb.png", 0, 0, 16, 64, 0, 0, "center")],
    // kageb_draw idle (variant 0)
    38: [p(G + "hashi.png", 0, 0, 32, 16, 0, 0, "center")],
    // bridge_edge_draw (W/3*2 x H of 48x16)
    58: [p(G + "jyama.png", 0, 0, 48, 32, 0, 0, "center")],
    // jyama_draw (whole image)
    42: [p(D + "item.png", 0, 0, 32, 32, 0, 0, "center")],
    // item_nflag_draw idle approx
    43: [p(D + "item.png", 0, 0, 32, 32, 0, 0, "center")],
    // Bten switch shares Button art (bonus_draw variant-0 row, sub==1-gated in-game)
    46: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")],
    // Switch unpressed: base + stem (switch2_draw, switchflag[var]==false)
    15: [
      p(D + "switch2.png", 0, 0, 32, 11, 0, -3, "center"),
      p(D + "switch2.png", 0, 11, 32, 5, 0, 5, "center")
    ],
    // Button: shown on touch in-game (bonus_draw gates on state); preview idle art
    45: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")],
    // Enemies via drawChara (framedata frame 0, HCENTER|VCENTER)
    41: [p(G + "musi.png", 0, 0, 40, 32, 0, 0, "center")],
    // framedata[41][0]
    40: [p(G + "hachi.png", 0, 0, 48, 32, 0, 0, "center")],
    // hachi_draw -> drawChara f0
    86: [p(G + "fish.png", 0, 0, 32, 32, 0, 0, "center")],
    // framedata[86][0]
    39: [p(G + "kamere.png", 0, 0, 56, 40, 0, 0, "center")],
    // framedata[39][0]
    57: [p(G + "kani.png", 0, 0, 48, 32, 0, 0, "center")]
    // framedata[57][0]
  };
  function springParts(sub, variant) {
    const img = sub % 16 === 2 ? D + "sjump2.png" : D + "sjump.png";
    const ori = Math.floor(sub / 16);
    if (ori === 1) {
      return variant === 0 ? [p(img, 0, 0, 32, 16, 0, 0, "center", 90)] : [p(img, 0, 0, 32, 16, 0, 0, "center", 270, true)];
    }
    if (ori >= 2) return [p(img, 0, 0, 32, 16, 0, 0, "center", 180, true)];
    return [p(img, 0, 0, 32, 16, 0, 8, "bottomcenter")];
  }
  function spikeParts(sub, variant) {
    const T = D + "toge.png";
    const U = variant === 2;
    const R180 = U ? 180 : void 0;
    if (sub === 48) {
      return [-24, 0, 24].map((ox) => p(T, 0, 0, 8, 32, ox, 0, "center", R180));
    }
    if (sub === 64) {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push(p(T, 16, 0, 8, 32, -60 + i * 24, 0, "center", R180));
      return parts;
    }
    if (sub === 16 || sub === 18) {
      return [p(T, 0, 0, 40, 32, -16, -20, "topleft", variant === 0 ? 270 : 90)];
    }
    if (sub === 82) {
      return variant === 0 ? [p(T, 16, 0, 8, 32, -16, -4, "topleft", 270, true)] : [p(T, 16, 0, 8, 32, -16, -4, "topleft", 90)];
    }
    if (sub === 32) return [p(T, 16, 0, 8, 32, 0, 0, "center", R180)];
    return [p(T, 0, 0, 40, 32, 0, 0, "center", R180)];
  }
  function swingParts(sub) {
    const B = D + "buranko.png";
    const parts = [p(B, 16, 16, 16, 16, 0, 0, "center")];
    const n = Math.max(0, sub);
    for (let i = 1; i <= n; i++) parts.push(p(B, 16, 32, 16, 16, 0, i * 16, "center"));
    parts.push(p(B, 0, 0, 48, 16, 0, (n + 1) * 16 - 8, "center"));
    return parts;
  }
  var ITEM_ROWS = [8, 0, 4, 3, 2, 1, 0];
  function monitorParts(sub) {
    if (sub <= 0 || sub >= 7) return null;
    const row2 = ITEM_ROWS[sub] ?? 0;
    if (row2 === 8) return [p(D + "item.png", 0, 256, 32, 16, 0, 8, "center")];
    return [
      p(D + "item.png", 0, row2 * 32, 32, 32, 0, 0, "center"),
      p(D + "item.png", 8, row2 * 32 + 7, 16, 14, 0, 0, "center")
    ];
  }
  function breakableParts(sub) {
    const B = G + "brkabe_g.png";
    const left = sub === 0 ? 0 : 16;
    const right = sub === 2 ? 32 : 16;
    const parts = [];
    for (let r = 0; r < 4; r++) {
      parts.push(p(B, left, 0, 16, 16, -16, -32 + r * 16, "topleft"));
      parts.push(p(B, right, 0, 16, 16, 0, -32 + r * 16, "topleft"));
    }
    return parts;
  }
  var SHIMA_H_FIRST = { 1: "left", 5: "right", 12: "right" };
  var SHIMA_V_FIRST = { 2: "up", 6: "down", 11: "up", 16: "up" };
  var BADGE_ORANGE = "#ff8c00";
  var BADGE_WHITE = "#ffffff";
  var BADGE_GRAY = "#888888";
  function badgePart(kind, dir, fill, w, h, ox, oy) {
    const part = p("", 0, 0, w, h, ox, oy, "center");
    part.badge = { kind, dir, fill };
    return part;
  }
  function triPair(first, axis, cy = 0, scale = 1) {
    const second = axis === "h" ? first === "left" ? "right" : "left" : first === "up" ? "down" : "up";
    const [w, h] = axis === "h" ? [8 * scale, 12 * scale] : [12 * scale, 8 * scale];
    const [w2, h2] = [w * 0.75, h * 0.75];
    const at = (d) => d === "left" ? [-4 * scale, cy] : d === "right" ? [4 * scale, cy] : d === "up" ? [0, cy - 4 * scale] : [0, cy + 4 * scale];
    const [fx, fy] = at(first);
    const [sx, sy] = at(second);
    return [
      badgePart("tri", first, BADGE_ORANGE, w, h, fx, fy),
      badgePart("tri", second, BADGE_GRAY, w2, h2, sx, sy)
    ];
  }
  function moveBadge(type, sub, cy = 0) {
    if (type !== 16 && type !== 90) return [];
    const scale = sub === 16 ? 32 / 24 : 1;
    const ring = badgePart("ring", void 0, BADGE_WHITE, 24 * scale, 24 * scale, 0, cy);
    if (sub === 7) return [ring, badgePart("tri", "up", BADGE_ORANGE, 12 * scale, 8 * scale, 0, cy)];
    if (sub === 3) return [ring, badgePart("tri", "down", BADGE_ORANGE, 12 * scale, 8 * scale, 0, cy)];
    const h = SHIMA_H_FIRST[sub];
    if (h !== void 0) return [ring, ...triPair(h, "h", cy, scale)];
    const v = SHIMA_V_FIRST[sub];
    if (v !== void 0) return [ring, ...triPair(v, "v", cy, scale)];
    return [];
  }
  function moveExtremes(type, sub) {
    if (type !== 16 && type !== 90) return [];
    const amp = {
      1: { ax: 64, ay: 0 },
      5: { ax: 64, ay: 0 },
      2: { ax: 0, ay: 64 },
      6: { ax: 0, ay: 64 },
      11: { ax: 0, ay: 48 },
      12: { ax: 0, ay: 48 },
      16: { ax: 0, ay: 32 }
    };
    const a = amp[sub];
    if (!a) return [];
    return [{ dx: -a.ax, dy: -a.ay }, { dx: a.ax, dy: a.ay }];
  }
  var SUBSPRITES = {
    // Monitors 42/43 contents (box + icon overlay; sub 0 spent omitted)
    42: { 1: monitorParts(1), 2: monitorParts(2), 3: monitorParts(3), 4: monitorParts(4), 5: monitorParts(5), 6: monitorParts(6) },
    43: { 1: monitorParts(1), 2: monitorParts(2), 3: monitorParts(3), 4: monitorParts(4), 5: monitorParts(5), 6: monitorParts(6) },
    // Buttons 45/46 art rows (shared bonus_draw)
    45: {
      0: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")],
      1: [p(D + "bten.png", 0, 48, 32, 24, 0, 0, "center")],
      2: [p(D + "bten.png", 0, 24, 32, 24, 0, 0, "center")],
      3: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")]
    },
    46: {
      0: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")],
      1: [p(D + "bten.png", 0, 48, 32, 24, 0, 0, "center")],
      2: [p(D + "bten.png", 0, 24, 32, 24, 0, 0, "center")],
      3: [p(D + "bten.png", 0, 0, 32, 24, 0, 0, "center")]
    },
    // Shima tall pillar (sub 16): top + 6 stacked segments (shima_draw)
    16: {
      16: [
        p(G + "shima.png", 0, 32, 64, 48, 0, 8, "center"),
        ...[0, 1, 2, 3, 4, 5].map((i) => p(G + "shima.png", 0, 64, 64, 16, 0, 40 + i * 16, "center"))
      ]
    },
    90: {
      16: [
        p(G + "shima.png", 0, 32, 64, 48, 0, 8, "center"),
        ...[0, 1, 2, 3, 4, 5].map((i) => p(G + "shima.png", 0, 64, 64, 16, 0, 40 + i * 16, "center"))
      ]
    },
    // Kageb frames (sub -> sheet frame; 0-2 solid, 16-18 decor)
    37: {
      0: [p(G + "kageb.png", 0, 0, 16, 64, 0, 0, "center")],
      1: [p(G + "kageb.png", 16, 0, 16, 64, 0, 0, "center")],
      2: [p(G + "kageb.png", 32, 0, 16, 64, 0, 0, "center")],
      16: [p(G + "kageb.png", 48, 0, 16, 64, 0, 0, "center")],
      17: [p(G + "kageb.png", 64, 0, 16, 64, 0, 0, "center")],
      18: [p(G + "kageb.png", 80, 0, 16, 64, 0, 0, "center")]
    },
    // Breakable GH debris styles (left/right column cells; full 2x4 stack)
    18: {
      0: breakableParts(0),
      1: breakableParts(1),
      2: breakableParts(2)
    }
  };
  function ringParts(type, sub) {
    const base = SPRITES[type][0];
    const n = 1 + Math.max(0, Math.min(127, sub));
    const steps = {
      0: [24, 0],
      1: [0, 24],
      63: [-16, 16],
      64: [16, 16],
      65: [32, 32],
      66: [16, 0],
      67: [32, 0],
      68: [0, 16],
      69: [0, 32]
    };
    const [dx, dy] = steps[type] ?? [0, 0];
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({ ...base, ox: base.ox + i * dx, oy: base.oy + i * dy });
    }
    return parts;
  }
  var RING_TYPES2 = /* @__PURE__ */ new Set([0, 1, 63, 64, 65, 66, 67, 68, 69]);
  var partsCache = /* @__PURE__ */ new Map();
  function partsFor(type, sub = 0, variant = 0) {
    const key = `${type}|${sub}|${variant}`;
    const hit = partsCache.get(key);
    if (hit !== void 0) return hit;
    const out = partsForUncached(type, sub, variant);
    partsCache.set(key, out);
    return out;
  }
  function partsForUncached(type, sub = 0, variant = 0) {
    if (!(type in SPRITES)) return null;
    if (RING_TYPES2.has(type)) return ringParts(type, sub);
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
  var cache = /* @__PURE__ */ new Map();
  function spriteImg(url) {
    let img = cache.get(url);
    if (!img) {
      img = new Image();
      img.src = url;
      cache.set(url, img);
    }
    return img;
  }
  function preloadSprites(onOneReady) {
    const urls = /* @__PURE__ */ new Set([
      // Dynamically resolved by springParts() (sub%16==2) — referenced by no
      // static table since the dead type-153 entry was removed.
      D + "sjump2.png"
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
  function partCorners(part) {
    let x0 = 0, y0 = 0, x1 = part.w, y1 = part.h;
    if (part.anchor === "center") {
      x0 = -part.w / 2;
      y0 = -part.h / 2;
      x1 = part.w / 2;
      y1 = part.h / 2;
    } else if (part.anchor === "bottomcenter") {
      x0 = -part.w / 2;
      y0 = -part.h;
      x1 = part.w / 2;
      y1 = 0;
    }
    const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    return pts.map(([x, y]) => {
      if (part.flip) x = -x;
      const r = part.rot ?? 0;
      if (r === 90) [x, y] = [-y, x];
      else if (r === 180) [x, y] = [-x, -y];
      else if (r === 270) [x, y] = [y, -x];
      return [part.ox + x, part.oy + y];
    });
  }
  var bboxCache = /* @__PURE__ */ new WeakMap();
  function spriteBBox(parts) {
    const hit = bboxCache.get(parts);
    if (hit) return hit;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of parts) {
      for (const [px, py] of partCorners(part)) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
    }
    const out = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    bboxCache.set(parts, out);
    return out;
  }
  function drawParts(ctx, parts, gx, gy, k, mirror = false) {
    ctx.imageSmoothingEnabled = false;
    if (mirror) {
      ctx.save();
      ctx.translate(2 * gx * k, 0);
      ctx.scale(-1, 1);
    }
    for (const part of parts) {
      if (part.badge) {
        drawBadge(ctx, part, gx, gy, k);
        continue;
      }
      const img = spriteImg(part.img);
      if (!img.complete || img.naturalWidth === 0) continue;
      const ax = (gx + part.ox) * k, ay = (gy + part.oy) * k;
      const dw = part.w * k, dh = part.h * k;
      if (part.rot || part.flip) {
        ctx.save();
        ctx.translate(ax, ay);
        if (part.rot) ctx.rotate(part.rot * Math.PI / 180);
        if (part.flip) ctx.scale(-1, 1);
        const rw = dw, rh = dh;
        let rx = 0, ry = 0;
        if (part.anchor === "center") {
          rx = -rw / 2;
          ry = -rh / 2;
        } else if (part.anchor === "bottomcenter") {
          rx = -rw / 2;
          ry = -rh;
        }
        ctx.drawImage(img, part.sx, part.sy, part.w, part.h, rx, ry, rw, rh);
        ctx.restore();
        continue;
      }
      let dx = ax, dy = ay;
      if (part.anchor === "center") {
        dx = ax - dw / 2;
        dy = ay - dh / 2;
      } else if (part.anchor === "bottomcenter") {
        dx = ax - dw / 2;
        dy = ay - dh;
      }
      ctx.drawImage(img, part.sx, part.sy, part.w, part.h, dx, dy, dw, dh);
    }
    if (mirror) ctx.restore();
  }
  function drawBadge(ctx, part, gx, gy, k) {
    const b = part.badge;
    const cx = (gx + part.ox) * k, cy = (gy + part.oy) * k;
    const bw = part.w * k, bh = part.h * k;
    ctx.save();
    if (b.kind === "ring") {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(bw, bh) / 2, 0, Math.PI * 2);
      ctx.fillStyle = BADGE_WHITE;
      ctx.fill();
    } else {
      let ox = 0, oy = 0;
      if (b.dir === "up") oy = -bh / 6;
      else if (b.dir === "down") oy = bh / 6;
      else if (b.dir === "left") ox = -bw / 6;
      else ox = bw / 6;
      const ccx = cx + ox, ccy = cy + oy;
      const x0 = ccx - bw / 2, y0 = ccy - bh / 2;
      const x1 = ccx + bw / 2, y1 = ccy + bh / 2;
      ctx.beginPath();
      if (b.dir === "up") {
        ctx.moveTo(ccx, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x0, y1);
      } else if (b.dir === "down") {
        ctx.moveTo(ccx, y1);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x0, y0);
      } else if (b.dir === "left") {
        ctx.moveTo(x0, ccy);
        ctx.lineTo(x1, y0);
        ctx.lineTo(x1, y1);
      } else {
        ctx.moveTo(x1, ccy);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x0, y1);
      }
      ctx.closePath();
      ctx.fillStyle = b.fill ?? BADGE_ORANGE;
      ctx.fill();
    }
    ctx.restore();
  }
  function spriteScale(cellSize4) {
    return cellSize4 / BLOCK_PX;
  }
  function paintThumb(c, parts, scale = 3, mirror = false) {
    for (const part of parts) {
      if (part.badge) continue;
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
  var FACING_TYPES = /* @__PURE__ */ new Set([39, 40, 41, 57, 86]);
  function isMirrored(type, variant, sub = 0) {
    if (FACING_TYPES.has(type)) return variant !== 0;
    if (type === 38) return variant === 0;
    if (type === 6) return sub !== 0;
    return false;
  }
  var thumbURLCache = /* @__PURE__ */ new Map();
  function spriteThumbURL(typeId, sub = 0, variant = 0, mirror = false) {
    const parts = partsFor(typeId, sub, variant);
    if (!parts) return null;
    const key = `${typeId}:${sub}:${variant}:${mirror ? 1 : 0}`;
    const hit = thumbURLCache.get(key);
    if (hit) return hit;
    const cvs = document.createElement("canvas");
    cvs.width = 256;
    cvs.height = 256;
    if (!paintThumb(cvs.getContext("2d"), parts, 3, mirror)) return null;
    const url = cvs.toDataURL();
    thumbURLCache.set(key, url);
    return url;
  }

  // ts/render.ts
  var GHOST_PX = 256;
  var ghostCanvas;
  var ghostCtx;
  var ghostKey = "";
  var thumbCache = /* @__PURE__ */ new Map();
  function thumbFor(type, sub, variant, mirror) {
    const key = `${type}:${sub}:${variant}:${mirror ? 1 : 0}`;
    const hit = thumbCache.get(key);
    if (hit) return hit;
    const parts = partsFor(type, sub, variant);
    if (!parts) return null;
    const cvs = document.createElement("canvas");
    if (!paintThumb(cvs.getContext("2d"), parts, 1, mirror)) return null;
    thumbCache.set(key, cvs);
    return cvs;
  }
  var whiteThumbCache = /* @__PURE__ */ new Map();
  function whiteThumbFor(type, sub, variant, mirror) {
    const key = `${type}:${sub}:${variant}:${mirror ? 1 : 0}`;
    const hit = whiteThumbCache.get(key);
    if (hit) return hit;
    const parts = partsFor(type, sub, variant);
    if (!parts) return null;
    const core = parts.filter((p2) => !p2.badge);
    if (!core.length) return null;
    const src = document.createElement("canvas");
    if (!paintThumb(src.getContext("2d"), core, 1, mirror)) return null;
    const cvs = document.createElement("canvas");
    cvs.width = src.width;
    cvs.height = src.height;
    const c = cvs.getContext("2d");
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, cvs.width, cvs.height);
    const bb = spriteBBox(core);
    const out = { cvs, bb };
    whiteThumbCache.set(key, out);
    return out;
  }
  function initGhostCanvas() {
    ghostCanvas = document.createElement("canvas");
    ghostCanvas.width = GHOST_PX;
    ghostCanvas.height = GHOST_PX;
    ghostCtx = ghostCanvas.getContext("2d");
  }
  var drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      draw();
    });
  }
  function draw() {
    const { ctx, canvas: cvs, canvasWrap, grid, objects, spritesheetImg } = S;
    if (!ctx || !cvs || !canvasWrap) return;
    const W = cvs.width, H = cvs.height, cs = cellSize();
    const scrollX = canvasWrap.scrollLeft, scrollY = canvasWrap.scrollTop;
    const viewW = canvasWrap.clientWidth || W, viewH = canvasWrap.clientHeight || H;
    ctx.setTransform(1, 0, 0, 1, -scrollX, -scrollY);
    ctx.fillStyle = "#f4f9f4";
    ctx.fillRect(scrollX, scrollY, viewW, viewH);
    const c0 = Math.max(0, Math.floor(scrollX / cs) - 1);
    const r0 = Math.max(0, Math.floor(scrollY / cs) - 1);
    const c1 = Math.min(grid[0].length, Math.ceil((scrollX + viewW) / cs) + 1);
    const r1 = Math.min(grid.length, Math.ceil((scrollY + viewH) / cs) + 1);
    const tileCs = cs / 16;
    const tc0 = Math.max(0, Math.floor(scrollX / tileCs) - 1);
    const tc1 = Math.min(grid[0].length * 16, Math.ceil((scrollX + viewW) / tileCs) + 1);
    const tr0 = Math.max(0, Math.floor(scrollY / tileCs) - 1);
    const tr1 = Math.min(grid.length * 16, Math.ceil((scrollY + viewH) / tileCs) + 1);
    const gx0 = scrollX, gx1 = scrollX + viewW, gy0 = scrollY, gy1 = scrollY + viewH;
    ctx.lineWidth = 1;
    const lineStyles = [
      [16, "rgba(128,128,128,0.35)"],
      [8, "rgba(128,128,128,0.18)"]
    ];
    for (const [mod, style] of lineStyles) {
      ctx.strokeStyle = style;
      ctx.beginPath();
      for (let t = tc0; t <= tc1; t++) {
        if (t % mod !== 0) continue;
        if (mod === 8 && t % 16 === 0) continue;
        const x = Math.round(t * tileCs) + 0.5;
        ctx.moveTo(x, gy0);
        ctx.lineTo(x, gy1);
      }
      for (let t = tr0; t <= tr1; t++) {
        if (t % mod !== 0) continue;
        if (mod === 8 && t % 16 === 0) continue;
        const y = Math.round(t * tileCs) + 0.5;
        ctx.moveTo(gx0, y);
        ctx.lineTo(gx1, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(128,128,128,0.08)";
    ctx.beginPath();
    for (let t = tc0; t <= tc1; t++) {
      if (t % 8 === 0) continue;
      const x = Math.round(t * tileCs) + 0.5;
      ctx.moveTo(x, gy0);
      ctx.lineTo(x, gy1);
    }
    for (let t = tr0; t <= tr1; t++) {
      if (t % 8 === 0) continue;
      const y = Math.round(t * tileCs) + 0.5;
      ctx.moveTo(gx0, y);
      ctx.lineTo(gx1, y);
    }
    ctx.stroke();
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const id = grid[r][c];
        const dx = c * cs, dy = r * cs;
        if (id > 0 && id < TOTAL_BLOCKS && spritesheetImg?.complete) {
          const { x: sx, y: sy } = blockSheetXY(id);
          try {
            ctx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, dx, dy, cs, cs);
          } catch (_) {
            ctx.fillStyle = "#aabbcc";
            ctx.fillRect(dx, dy, cs, cs);
          }
        } else if (id > 0) {
          ctx.fillStyle = "#aabbcc";
          ctx.fillRect(dx, dy, cs, cs);
        }
      }
    }
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
        const t = thumbFor(obj.type, obj.sub, obj.variant, mirror);
        ctx.imageSmoothingEnabled = false;
        if (t) ctx.drawImage(t, 0, 0, t.width, t.height, bx0, by0, bw, bh);
        else drawParts(ctx, parts, obj.x, obj.y, k, mirror);
        if (isSel) {
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
          ctx.strokeStyle = "#f00";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(bx0 - 3, by0 - 3, bw + 6, bh + 6);
          ctx.setLineDash([]);
        }
        continue;
      }
      const dx = obj.x / BLOCK_PX * cs;
      const dy = obj.y / BLOCK_PX * cs;
      const m = Math.max(14, Math.min(48, cs * 0.35));
      if (dx + m < scrollX || dx - m > scrollX + viewW || dy + m < scrollY || dy - m > scrollY + viewH) continue;
      const def = findDef(obj.type);
      ctx.fillStyle = isSel ? "rgba(255,80,80,0.7)" : "rgba(160,160,160,0.5)";
      ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
      ctx.strokeStyle = isSel ? "#f00" : "#666";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(dx - m / 2, dy - m / 2, m, m);
      ctx.setLineDash([]);
      if (cs >= 24) {
        ctx.fillStyle = "#000";
        ctx.font = `${Math.max(8, Math.round(m / 3))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def ? def.name.split(" ")[0] : `${obj.type}`, dx, dy);
      }
    }
    const hx = S.hoverBx, hy = S.hoverBy;
    if (hx >= 0 && hy >= 0 && hy < grid.length && hx < grid[0].length && grid[hy][hx] > 0 && S.gloweyImg?.complete && S.gloweyImg.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = glowAlpha();
      try {
        ctx.drawImage(S.gloweyImg, hx * cs, hy * cs, cs, cs);
      } catch (_) {
      }
      ctx.globalAlpha = prevAlpha;
    }
    if (S.paletteDrag && S.previewOnCanvas && S.activeTab !== "tiles") {
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
          const dx = px / BLOCK_PX * cs, dy = py / BLOCK_PX * cs;
          const m = Math.max(14, Math.min(48, cs * 0.35));
          if (!(dx + m < scrollX || dx - m > scrollX + viewW || dy + m < scrollY || dy - m > scrollY + viewH)) {
            ctx.fillStyle = "rgba(255,200,0,0.5)";
            ctx.fillRect(dx - m / 2, dy - m / 2, m, m);
          }
        }
      }
    }
    drawTileSelection(scrollX, scrollY, viewW, viewH, cs);
  }
  function objectHitIndex(mx, my) {
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
        const dx = obj.x / BLOCK_PX * cs, dy = obj.y / BLOCK_PX * cs;
        const m = Math.max(14, Math.min(48, cs * 0.35));
        if (mx >= dx - m / 2 && mx < dx + m / 2 && my >= dy - m / 2 && my < dy + m / 2) return i;
      }
    }
    return -1;
  }
  function tileBadge(bx, by, cs) {
    if (bx < 0 || by < 0 || by >= S.grid.length || bx >= S.grid[0].length) return null;
    const r = Math.max(5, Math.min(10, cs * 0.15));
    return { cx: (bx + 1) * cs, cy: by * cs + cs / 16, r };
  }
  function selectedTileLive() {
    const { selectedTileBx: bx, selectedTileBy: by, grid } = S;
    return bx >= 0 && by >= 0 && by < grid.length && bx < grid[0].length && grid[by][bx] > 0;
  }
  function hitTileBadge(mx, my, cs) {
    if (!selectedTileLive()) return false;
    const b = tileBadge(S.selectedTileBx, S.selectedTileBy, cs);
    if (!b) return false;
    const dx = mx - b.cx, dy = my - b.cy;
    const rr = b.r + 2;
    return dx * dx + dy * dy <= rr * rr;
  }
  function drawTileSelection(scrollX, scrollY, viewW, viewH, cs) {
    if (!selectedTileLive()) return;
    const bx = S.selectedTileBx, by = S.selectedTileBy;
    const x0 = bx * cs, y0 = by * cs;
    const b = tileBadge(bx, by, cs);
    if (x0 - b.r > scrollX + viewW || x0 + cs + b.r < scrollX || y0 - b.r > scrollY + viewH || y0 + cs + b.r < scrollY) return;
    const { ctx } = S;
    if (!ctx) return;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x0, y0, cs, cs);
    ctx.fillStyle = "#999999";
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
    ctx.fill();
    const arm = b.r * 0.45;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, b.r * 0.28);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(b.cx - arm, b.cy - arm);
    ctx.lineTo(b.cx + arm, b.cy + arm);
    ctx.moveTo(b.cx + arm, b.cy - arm);
    ctx.lineTo(b.cx - arm, b.cy + arm);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineWidth = 1;
  }
  var GLOW_PERIOD_MS = 1600;
  function glowAlpha(now = performance.now()) {
    const phase = now % GLOW_PERIOD_MS / GLOW_PERIOD_MS;
    return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  }
  function hoverGlowActive() {
    const { grid, hoverBx, hoverBy } = S;
    return hoverBx >= 0 && hoverBy >= 0 && hoverBy < grid.length && hoverBx < grid[0].length && grid[hoverBy][hoverBx] > 0;
  }
  var glowRaf = 0;
  function ensureGlowLoop() {
    if (glowRaf || !hoverGlowActive()) return;
    const tick = () => {
      if (!hoverGlowActive()) {
        glowRaf = 0;
        return;
      }
      draw();
      glowRaf = requestAnimationFrame(tick);
    };
    glowRaf = requestAnimationFrame(tick);
  }
  function updateGhost(e) {
    const { ghostEl, spritesheetImg, activeTab } = S;
    if (!ghostEl) return;
    if (!S.paletteDrag) {
      hideGhost();
      return;
    }
    if (S.canvas) {
      try {
        const { bx, by, px, py } = canvasToWorld(e);
        S.previewOnCanvas = inGrid(bx, by);
        S.previewPX = snap8(px);
        S.previewPY = snap8(py);
      } catch (_) {
        S.previewOnCanvas = false;
      }
    } else {
      S.previewOnCanvas = false;
    }
    const cs = cellSize();
    let key;
    if (activeTab === "tiles") {
      key = `t:${S.paletteDragTile}|${spritesheetImg?.complete ? 1 : 0}|${cs}`;
    } else if (S.paletteDragDef) {
      const kd = S.paletteDragDef;
      const ks = kd.sub ?? 0, kv = kd.variant ?? 0;
      key = `o:${kd.id}|${ks}|${kv}|${!!kd.mirror || isMirrored(kd.id, kv, ks)}|${cs}`;
    } else {
      key = `x|${cs}`;
    }
    const rebuild = key !== ghostKey;
    ghostKey = key;
    ghostEl.classList.add("visible");
    ghostEl.style.display = "";
    ghostEl.style.width = cs + "px";
    ghostEl.style.height = cs + "px";
    ghostEl.style.left = e.clientX - cs / 2 + "px";
    ghostEl.style.top = e.clientY - cs / 2 + "px";
    if (activeTab === "tiles" && spritesheetImg?.complete) {
      if (rebuild) {
        ghostCtx.clearRect(0, 0, GHOST_PX, GHOST_PX);
        const { x: sx, y: sy } = blockSheetXY(S.paletteDragTile);
        ghostCtx.imageSmoothingEnabled = false;
        ghostCtx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, GHOST_PX, GHOST_PX);
        ghostEl.style.backgroundImage = `url(${ghostCanvas.toDataURL()})`;
        ghostEl.style.backgroundSize = "100% 100%";
      }
      ghostEl.style.display = "";
    } else if (S.paletteDragDef) {
      const def = S.paletteDragDef;
      const dsub = def.sub ?? 0, dvar = def.variant ?? 0;
      const dmirror = !!def.mirror || isMirrored(def.id, dvar, dsub);
      const parts = partsFor(def.id, dsub, dvar);
      const url = spriteThumbURL(def.id, dsub, dvar, dmirror);
      if (url && parts) {
        const k = spriteScale(cs);
        const bb = spriteBBox(parts);
        ghostEl.style.width = Math.max(1, bb.w * k) + "px";
        ghostEl.style.height = Math.max(1, bb.h * k) + "px";
        ghostEl.style.left = e.clientX + bb.x * k + "px";
        ghostEl.style.top = e.clientY + bb.y * k + "px";
        if (rebuild) {
          ghostEl.style.backgroundImage = `url(${url})`;
          ghostEl.style.backgroundSize = "100% 100%";
        }
        ghostEl.style.backgroundRepeat = "no-repeat";
        ghostEl.style.backgroundPosition = "center";
        ghostEl.style.backgroundColor = "rgba(0,0,0,0.3)";
        ghostEl.style.display = "";
        ghostEl.textContent = "";
      } else {
        ghostEl.style.backgroundImage = "none";
        ghostEl.style.backgroundColor = "rgba(255,200,0,0.5)";
        ghostEl.style.display = "flex";
        ghostEl.style.alignItems = "center";
        ghostEl.style.justifyContent = "center";
        ghostEl.style.fontSize = "10px";
        ghostEl.style.color = "#fff";
        ghostEl.style.textAlign = "center";
        ghostEl.textContent = S.paletteDragDef.name.split(" ")[0];
      }
    } else {
      ghostEl.style.backgroundImage = "none";
      ghostEl.style.backgroundColor = "rgba(255,200,0,0.5)";
      ghostEl.style.display = "flex";
      ghostEl.style.alignItems = "center";
      ghostEl.style.justifyContent = "center";
      ghostEl.style.fontSize = "10px";
      ghostEl.style.color = "#fff";
      ghostEl.style.textAlign = "center";
      ghostEl.textContent = "";
    }
    if (S.previewOnCanvas && S.activeTab !== "tiles") requestDraw();
  }
  function hideGhost() {
    const { ghostEl } = S;
    ghostKey = "";
    S.previewOnCanvas = false;
    if (!ghostEl) return;
    ghostEl.classList.remove("visible");
    ghostEl.style.display = "";
  }

  // ts/tooltipTexts.ts
  var TOOLTIPS = [
    // ── Essentials ──
    { id: 151, name: "Sonic Spawn", desc: "Starting point for your level. (Required)" },
    { id: 44, name: "Sign Post", desc: "End point for your level. (Required)" },
    { id: 36, name: "Star Post", desc: "This is a Checkpoint, be careful where you place them!" },
    // ── Springs (type 2) ──
    { id: 2, sub: 0, name: "Red Spring", desc: "This spring has a strong bounce. (faces up)" },
    { id: 2, variant: 0, sub: 16, name: "Red Spring", desc: "This spring has a strong bounce. (faces right)" },
    { id: 2, variant: 1, sub: 16, name: "Red Spring", desc: "This spring has a strong bounce. (faces left)" },
    { id: 2, sub: 32, name: "Red Spring Down", desc: "This spring has a strong bounce. (faces down)" },
    { id: 2, sub: 2, name: "Yellow Spring", desc: "This spring has a weak bounce. (faces up)" },
    { id: 2, variant: 0, sub: 18, name: "Yellow Spring R", desc: "This spring has a weak bounce. (faces right)" },
    { id: 2, variant: 1, sub: 18, name: "Yellow Spring L", desc: "This spring has a weak bounce. (faces left)" },
    { id: 2, sub: 34, name: "Yellow Spring Down", desc: "This spring has a weak bounce. (faces down)" },
    // ── Spikes (type 9) ──
    { id: 9, sub: 32, name: "Single Spike", desc: "Single ground spike (faces up)" },
    { id: 9, variant: 0, sub: 82, name: "Single Spike", desc: "Single wall spike (faces left)" },
    { id: 9, variant: 1, sub: 82, name: "Single Spike", desc: "Single wall spike (faces right)" },
    { id: 9, sub: 48, name: "Triple Spikes", desc: "Wide spike trap (faces up)" },
    { id: 9, sub: 0, name: "Triple Spikes", desc: "Narrow spike trap (faces up)" },
    { id: 9, variant: 2, sub: 0, name: "Triple Spikes", desc: "Narrow spike trap (faces down)" },
    { id: 9, variant: 0, sub: 16, name: "Triple Spikes", desc: "Wall spikes (faces left)" },
    { id: 9, variant: 1, sub: 16, name: "Triple Spikes", desc: "Wall spikes (faces right)" },
    { id: 9, variant: 0, sub: 18, name: "Triple Spikes", desc: "Sliding spikes (extends on a timer)" },
    { id: 9, sub: 64, name: "Ultimate Spikes", desc: "Overkill! (use this SPARINGLY)" },
    // ── Switch / Buttons / Monitors ──
    { id: 15, sub: 0, name: "Button", desc: "Press to activate. (Button 1)" },
    { id: 15, sub: 1, name: "Button", desc: "Press to activate. (Button 2)" },
    { id: 15, sub: 2, name: "Button", desc: "Press to activate. (Button 3)" },
    { id: 45, sub: 1, name: "10000 Score", desc: "Place above the Goal Post. (Awards extra points!)" },
    { id: 45, sub: 2, name: "1000 Score", desc: "Place above the Goal Post. (Awards extra points!)" },
    { id: 45, sub: 3, name: "100 Score", desc: "Place above the Goal Post. (Awards extra points!)" },
    { id: 43, sub: 1, name: "Empty Monitor", desc: "This REALLY shouldn't be here." },
    { id: 43, sub: 2, name: "1-Up Monitor", desc: "Grants you another life, lucky you!" },
    { id: 43, sub: 3, name: "Speed Monitor", desc: "GOTTA GO FAST!!" },
    { id: 43, sub: 4, name: "Shield Monitor", desc: "Grants you an extra hit without losing your rings." },
    { id: 43, sub: 5, name: "Invincibility Monitor", desc: "Grants Invincibility for a short time." },
    { id: 43, sub: 6, name: "Ring Monitor", desc: "Grants you 10 rings." },
    // ── Bridges / Walls ──
    { id: 4, sub: 16, name: "Spike Bridge", desc: "Rotating wooden hazard, decorated in pointy spikes!" },
    { id: 5, sub: 12, name: "Bridge", desc: "Standard bridge." },
    { id: 38, variant: 0, sub: 3, name: "Bridge Pole", desc: "Decoration to end the bridge. (left side)" },
    { id: 38, variant: 1, sub: 3, name: "Bridge Pole", desc: "Decoration to end the bridge. (right side)" },
    { id: 6, sub: 0, name: "Breakable Ground", desc: "Can only be walked on once. (faces left)" },
    { id: 6, variant: 1, sub: 1, name: "Breakable Ground", desc: "Can only be walked on once. (faces right)" },
    { id: 18, sub: 0, name: "Breakable Wall", desc: "Roll through at high speeds to break, style A." },
    { id: 18, sub: 1, name: "Breakable Wall", desc: "Roll through at high speeds to break, style B." },
    { id: 18, sub: 2, name: "Breakable Wall", desc: "Roll through at high speeds to break, style C. " },
    // ── Swings / Platforms / Blocks ──
    { id: 3, sub: 6, name: "Moving Swing", desc: "This platform rocks back and forth (small)" },
    { id: 3, sub: 7, name: "Moving Swing", desc: "This platform rocks back and forth (medium)" },
    { id: 3, sub: 8, name: "Moving Swing", desc: "This platform rocks back and forth (large)" },
    { id: 3, variant: 1, sub: 6, name: "Moving Swing", desc: "This platform rocks in reverse (small, variant 1)" },
    { id: 16, sub: 0, name: "Moving Platform", desc: "This platform doesn't move." },
    { id: 16, sub: 1, name: "Moving Platform", desc: "This platform first moves LEFT, then moves RIGHT." },
    { id: 16, sub: 2, name: "Moving Platform", desc: "This platform first moves UP, then moves DOWN." },
    { id: 16, sub: 3, name: "Moving Platform", desc: "This platform can only be walked on ONCE, Breaks apart." },
    { id: 16, sub: 16, name: "Moving Platform", desc: "This tall platform first moves UP, then moves DOWN." },
    { id: 16, sub: 7, name: "Moving Platform", desc: "This platform is activated by a switch." },
    { id: 37, sub: 0, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 37, sub: 1, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 37, sub: 2, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 37, sub: 16, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 37, sub: 17, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 37, sub: 18, name: "Solid Wall", desc: "Use to stop Sonic from walking through walls." },
    { id: 58, name: "Boulder", desc: "Purely Decoration." },
    // ── Enemies (Green Hill set) ──
    { id: 41, name: "Motobug Badnik", desc: "This badnik rolls back and forth along the ground. (left first)" },
    { id: 41, variant: 1, name: "Motobug Badnik", desc: "This badnik rolls back and forth along the ground. (right first)" },
    { id: 40, name: "Buzz Bomber Badnik", desc: "This badnik patrols back and forth and shoots pellets. (left first)" },
    { id: 40, variant: 1, name: "Buzz Bomber Badnik", desc: "This badnik patrols back and forth and shoots pellets. (right first)" },
    { id: 86, name: "Fish Chopper Badnik", desc: "This badnik jumps up and down over and over. (Place in water)" },
    { id: 39, name: "Newtron Badnik (Blue)", desc: "This badnik hides until passed, then propells forwards. (faces left)" },
    { id: 39, variant: 1, name: "Newtron Badnik (Blue)", desc: "This badnik hides until passed, then propells forwards. (faces right)" },
    { id: 39, sub: 1, name: "Newtron Badnik (Green)", desc: "This badnik hides until passed, then shoots pellets. (faces left)" },
    { id: 39, variant: 1, sub: 1, name: "Newtron Badnik (Green)", desc: "This badnik hides until passed, then shoots pellets. (faces right)" },
    { id: 57, name: "Crabmeat Badnik", desc: "This badnik waddles back and forth, then shoots pellets. (left first)" },
    { id: 57, variant: 1, name: "Crabmeat Badnik", desc: "This badnik waddles back and forth, then shoots pellets. (right first)" },
    // ── Rings (layouts × counts) ──
    { id: 0, sub: 0, name: "Single Ring", desc: "Where does Sonic store them?" },
    { id: 0, sub: 1, name: "Ring Bunch", desc: "Horizontal line of 2 rings." },
    { id: 0, sub: 2, name: "Ring Bunch", desc: "Horizontal line of 3 rings." },
    { id: 0, sub: 3, name: "Ring Bunch", desc: "Horizontal line of 4 rings." },
    { id: 0, sub: 4, name: "Ring Bunch", desc: "Horizontal line of 5 rings." },
    { id: 0, sub: 5, name: "Ring Bunch", desc: "Horizontal line of 6 rings." },
    { id: 0, sub: 6, name: "Ring Bunch", desc: "Horizontal line of 7 rings." },
    { id: 1, sub: 1, name: "Ring Bunch", desc: "Vertical line of 2 rings." },
    { id: 1, sub: 2, name: "Ring Bunch", desc: "Vertical line of 3 rings." },
    { id: 1, sub: 3, name: "Ring Bunch", desc: "Vertical line of 4 rings." },
    { id: 1, sub: 4, name: "Ring Bunch", desc: "Vertical line of 5 rings." },
    { id: 1, sub: 5, name: "Ring Bunch", desc: "Vertical line of 6 rings." },
    { id: 1, sub: 6, name: "Ring Bunch", desc: "Vertical line of 7 rings." },
    { id: 63, sub: 1, name: "Ring Bunch", desc: "Diagonal line of 2 rings. (left to right)" },
    { id: 63, sub: 2, name: "Ring Bunch", desc: "Diagonal line of 3 rings. (left to right)" },
    { id: 63, sub: 3, name: "Ring Bunch", desc: "Diagonal line of 4 rings. (left to right)" },
    { id: 63, sub: 4, name: "Ring Bunch", desc: "Diagonal line of 5 rings. (left to right)" },
    { id: 63, sub: 5, name: "Ring Bunch", desc: "Diagonal line of 6 rings. (left to right)" },
    { id: 63, sub: 6, name: "Ring Bunch", desc: "Diagonal line of 7 rings. (left to right)" },
    { id: 64, sub: 1, name: "Ring Bunch", desc: "Diagonal line of 2 rings. (right to left)" },
    { id: 64, sub: 2, name: "Ring Bunch", desc: "Diagonal line of 3 rings. (right to left)" },
    { id: 64, sub: 3, name: "Ring Bunch", desc: "Diagonal line of 4 rings. (right to left)" },
    { id: 64, sub: 4, name: "Ring Bunch", desc: "Diagonal line of 5 rings. (right to left)" },
    { id: 64, sub: 5, name: "Ring Bunch", desc: "Diagonal line of 6 rings. (right to left)" },
    { id: 64, sub: 6, name: "Ring Bunch", desc: "Diagonal line of 7 rings. (right to left)" },
    { id: 65, sub: 1, name: "Ring Bunch", desc: "Wider diagonal line of 2 rings. (right to left)" },
    { id: 65, sub: 2, name: "Ring Bunch", desc: "Wider diagonal line of 3 rings. (right to left)" },
    { id: 65, sub: 3, name: "Ring Bunch", desc: "Wider diagonal line of 4 rings. (right to left)" },
    { id: 65, sub: 4, name: "Ring Bunch", desc: "Wider diagonal line of 5 rings. (right to left)" },
    { id: 65, sub: 5, name: "Ring Bunch", desc: "Wider diagonal line of 6 rings. (right to left)" },
    { id: 65, sub: 6, name: "Ring Bunch", desc: "Wider diagonal line of 7 rings. (right to left)" },
    { id: 66, sub: 1, name: "Ring Bunch", desc: "Thinner horizontal line of 2 rings." },
    { id: 66, sub: 2, name: "Ring Bunch", desc: "Thinner horizontal line of 3 rings." },
    { id: 66, sub: 3, name: "Ring Bunch", desc: "Thinner horizontal line of 4 rings." },
    { id: 66, sub: 4, name: "Ring Bunch", desc: "Thinner horizontal line of 5 rings." },
    { id: 66, sub: 5, name: "Ring Bunch", desc: "Thinner horizontal line of 6 rings." },
    { id: 66, sub: 6, name: "Ring Bunch", desc: "Thinner horizontal line of 7 rings." },
    { id: 67, sub: 1, name: "Ring Bunch", desc: "Wider horizontal line of 2 rings." },
    { id: 67, sub: 2, name: "Ring Bunch", desc: "Wider horizontal line of 3 rings." },
    { id: 67, sub: 3, name: "Ring Bunch", desc: "Wider horizontal line of 4 rings." },
    { id: 67, sub: 4, name: "Ring Bunch", desc: "Wider horizontal line of 5 rings." },
    { id: 67, sub: 5, name: "Ring Bunch", desc: "Wider horizontal line of 6 rings." },
    { id: 67, sub: 6, name: "Ring Bunch", desc: "Wider horizontal line of 7 rings." },
    { id: 68, sub: 1, name: "Ring Bunch", desc: "Thinner vertical line of 2 rings." },
    { id: 68, sub: 2, name: "Ring Bunch", desc: "Thinner vertical line of 3 rings." },
    { id: 68, sub: 3, name: "Ring Bunch", desc: "Thinner vertical line of 4 rings." },
    { id: 68, sub: 4, name: "Ring Bunch", desc: "Thinner vertical line of 5 rings." },
    { id: 68, sub: 5, name: "Ring Bunch", desc: "Thinner vertical line of 6 rings." },
    { id: 68, sub: 6, name: "Ring Bunch", desc: "Thinner vertical line of 7 rings." },
    { id: 69, sub: 1, name: "Ring Bunch", desc: "Wider vertical line of 2 rings." },
    { id: 69, sub: 2, name: "Ring Bunch", desc: "Wider vertical line of 3 rings." },
    { id: 69, sub: 3, name: "Ring Bunch", desc: "Wider vertical line of 4 rings." },
    { id: 69, sub: 4, name: "Ring Bunch", desc: "Wider vertical line of 5 rings." },
    { id: 69, sub: 5, name: "Ring Bunch", desc: "Wider vertical line of 6 rings." },
    { id: 69, sub: 6, name: "Ring Bunch", desc: "Wider vertical line of 7 rings." }
  ];

  // ts/thumbnails.ts
  var lastThumbLog = "";
  var tipEl = null;
  var tipTimer = null;
  var tipAnchor = null;
  function ensureTip() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "obj-tooltip";
    tipEl.setAttribute("role", "tooltip");
    const text = document.createElement("div");
    text.className = "tip-text";
    const bottom = document.createElement("div");
    bottom.className = "tip-bottom";
    tipEl.appendChild(text);
    tipEl.appendChild(bottom);
    const host = S.shadow;
    if (host && host.appendChild) {
      S.shadow.appendChild(tipEl);
    } else {
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function tipTextEl() {
    const el = ensureTip();
    return el.querySelector(".tip-text");
  }
  function hideTip() {
    if (tipTimer) {
      clearTimeout(tipTimer);
      tipTimer = null;
    }
    tipAnchor = null;
    if (tipEl) tipEl.classList.remove("visible");
  }
  function positionTip(anchor) {
    const el = ensureTip();
    const r = anchor.getBoundingClientRect();
    el.style.left = "0";
    el.style.top = "-9999px";
    el.classList.add("visible");
    el.style.visibility = "hidden";
    const tr = el.getBoundingClientRect();
    el.style.visibility = "";
    el.classList.remove("visible");
    const gap = 2;
    const ARROW_GAP = 30;
    const thumbArrowX = r.left + r.width * 0.3;
    let left = thumbArrowX - ARROW_GAP;
    let top = r.top - tr.height - gap;
    const pad = 4;
    left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
    if (top < pad) top = r.bottom + gap;
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
    const arrowOffset = thumbArrowX - (left + ARROW_GAP);
    el.style.setProperty("--tip-arrow-offset", arrowOffset + "px");
    requestAnimationFrame(() => el.classList.add("visible"));
  }
  function scheduleTip(text, anchor) {
    hideTip();
    tipAnchor = anchor;
    tipTextEl().textContent = text;
    tipTimer = setTimeout(() => {
      if (tipAnchor !== anchor) return;
      positionTip(anchor);
    }, 450);
  }
  function attachTip(el, text) {
    el.addEventListener("mouseenter", () => scheduleTip(text, el));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("mousedown", hideTip);
    el.addEventListener("wheel", hideTip, { passive: true });
  }
  function findTip(id, variant = 0, sub = 0) {
    return TOOLTIPS.find((t) => t.id === id && (t.variant ?? 0) === variant && (t.sub ?? 0) === sub) ?? TOOLTIPS.find((t) => t.id === id && (t.variant ?? 0) === variant) ?? TOOLTIPS.find((t) => t.id === id);
  }
  function tooltipForDef(def) {
    const t = findTip(def.id, def.variant ?? 0, def.sub ?? 0);
    return t ? `${t.name}: ${t.desc}` : "";
  }
  function updateCounter() {
    if (!S.counterEl) return;
    const totalTiles = S.grid.length * (S.grid[0]?.length || 0);
    const placedTiles = countPlacedTiles();
    S.counterEl.textContent = `${totalObjects()}/${placedTiles}`;
  }
  function buildThumbnails() {
    hideTip();
    const { thumbstrip, spritesheetImg, activeTab } = S;
    if (!thumbstrip) return;
    thumbstrip.innerHTML = "";
    let painted = 0, total = 0;
    if (activeTab === "tiles") {
      for (let i = 1; i <= 107 && i < USED_BLOCKS; i++) {
        if (i === 7 || i === 35 || i === 71) continue;
        const el = document.createElement("div");
        el.className = "thumb";
        const cvs = document.createElement("canvas");
        cvs.width = BLOCK_PX;
        cvs.height = BLOCK_PX;
        const c = cvs.getContext("2d");
        if (spritesheetImg?.complete) {
          const { x: sx, y: sy } = blockSheetXY(i);
          c.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, BLOCK_PX, BLOCK_PX);
          painted++;
        }
        total++;
        el.appendChild(cvs);
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          S.selectedTile = i;
          S.selectedObj = null;
          S.selectedObjIdx = -1;
          S.selectedTileBx = -1;
          S.selectedTileBy = -1;
          S.paletteDrag = true;
          S.paletteDragTile = i;
          updateDesc(`Block ${i} \u2014 drag onto grid to place`);
          draw();
        });
        thumbstrip.appendChild(el);
      }
    } else {
      for (const def of defsForTab(activeTab)) {
        const el = document.createElement("div");
        const sub = def.sub ?? 0, variant = def.variant ?? 0;
        const mirror = !!def.mirror || isMirrored(def.id, variant, sub);
        const noArt = !partsFor(def.id, sub, variant);
        const baseTip = tooltipForDef(def);
        const tipText = baseTip + (noArt ? " (invisible in-game: no art in this zone)" : "");
        attachTip(el, tipText);
        const parts = partsFor(def.id, sub, variant);
        let cvs = null;
        if (parts) {
          el.className = "thumb thumb-obj";
          cvs = document.createElement("canvas");
          paintThumb(cvs.getContext("2d"), parts, 1, mirror);
          el.appendChild(cvs);
          painted++;
        } else {
          el.className = "thumb thumb-txt";
          el.textContent = def.name;
        }
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          S.selectedObj = def;
          S.selectedObjIdx = -1;
          S.selectedTileBx = -1;
          S.selectedTileBy = -1;
          S.paletteDrag = true;
          S.paletteDragDef = def;
          updateDesc(`${def.name}: ${def.desc}` + (noArt ? " (invisible in-game: no art in this zone)" : ""));
          draw();
        });
        thumbstrip.appendChild(el);
        total++;
        if (cvs) {
          const boxH = el.clientHeight * 0.8, boxW = el.clientWidth * 0.8;
          if (boxH > 0 && boxW > 0 && cvs.width > 0 && cvs.height > 0) {
            const s = Math.min(1, boxW / cvs.width, boxH / cvs.height);
            cvs.style.width = Math.max(1, Math.floor(cvs.width * s)) + "px";
            cvs.style.height = Math.max(1, Math.floor(cvs.height * s)) + "px";
          }
        }
      }
    }
    const summary = `${activeTab} painted=${painted}/${total}`;
    if (summary !== lastThumbLog) {
      lastThumbLog = summary;
      timingLog(`thumbnails ${summary}`);
    }
  }
  function switchTab(tab) {
    S.activeTab = tab;
    S.selectedObj = null;
    S.selectedObjIdx = -1;
    S.selectedTileBx = -1;
    S.selectedTileBy = -1;
    S.shadow.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("tab-active", b.getAttribute("data-tab") === tab);
    });
    buildThumbnails();
    updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab \u2014 select an item below`);
    draw();
  }

  // ts/actions.ts
  function levelValid() {
    const sonics = S.objects.filter((o) => o.type === 151).length;
    const goals = S.objects.filter((o) => o.type === 44).length;
    return sonics === 1 && goals === 1;
  }
  function levelCSV() {
    return toCSV(encodeBin(S.grid), encodeAct(S.objects));
  }
  function doStartCreating() {
    const input = S.shadow.querySelector(".start-name");
    const name = (input?.value ?? "").trim();
    S.levelName = name || "The Guide Zone";
    S.shadow.querySelector(".start-overlay")?.classList.add("hidden");
    input?.blur();
    resizeCanvas();
  }
  function doSave() {
    if (!levelValid()) return;
    const blob = new Blob([levelCSV()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const slug = S.levelName.trim().replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
    a.download = (slug || "custom-level") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
  }
  var TEST_API_ID = "api-connector";
  var TEST_LEVEL_ID = "2914";
  var TEST_LOAD_OPTS = {
    url: "/games/swf/52/52.swf",
    parameters: { id: TEST_API_ID, levelid: TEST_LEVEL_ID, editortest: "1" },
    // Aspect-preserving fill of the whole editor space, centered:
    // showAll scales the stage with aspect intact, letterbox "on" draws
    // the bars even when not fullscreen (page global is "off"), and
    // forceScale stops the game from switching its own Stage.scaleMode
    // (e.g. exactFit/noScale) and stretching. Per-movie options only —
    // the page global config is untouched.
    scale: "showAll",
    letterbox: "on",
    forceScale: true
  };
  var testPlayer = null;
  var testBooting = null;
  var testReady = false;
  function callEditorStartAudio() {
    if (!testPlayer) return;
    try {
      if (typeof testPlayer.editorStartAudio === "function") testPlayer.editorStartAudio();
    } catch (_) {
    }
    try {
      const api = testPlayer.ruffle ? testPlayer.ruffle() : null;
      if (api && typeof api.editorStartAudio === "function") api.editorStartAudio();
    } catch (_) {
    }
  }
  function setTestVolume(v) {
    if (!testPlayer) return;
    try {
      const api = testPlayer.ruffle ? testPlayer.ruffle() : testPlayer;
      if (api && typeof api.volume === "number") api.volume = v;
    } catch (_) {
    }
    try {
      if (typeof testPlayer.volume === "number") testPlayer.volume = v;
    } catch (_) {
    }
  }
  function ensureTestPlayer() {
    if (testPlayer) return true;
    const els = testEls();
    if (!els) return false;
    const RP = window.RufflePlayer;
    if (!RP || !RP.newest) {
      console.error("[editor] Ruffle not loaded \u2014 cannot start test mode");
      return false;
    }
    try {
      testPlayer = RP.newest().createPlayer();
    } catch (e) {
      console.error("[editor] Ruffle createPlayer failed", e);
      testPlayer = null;
      return false;
    }
    setTestVolume(0);
    els.holder.appendChild(testPlayer);
    setTestVolume(0);
    return true;
  }
  function bootTestMovie(force = false) {
    if (testReady && !force) return Promise.resolve();
    if (testBooting) return testBooting;
    const player = testPlayer;
    if (!player) return Promise.resolve();
    if (force) testReady = false;
    testBooting = (async () => {
      const api = player.ruffle ? player.ruffle() : player;
      await api.load({ ...TEST_LOAD_OPTS });
      testReady = true;
      const els = testEls();
      if (els && els.mode.classList.contains("active")) {
        setTestVolume(1);
        callEditorStartAudio();
      } else {
        setTestVolume(0);
      }
    })().catch((e) => {
      testReady = false;
      console.error("[editor] Ruffle load failed", e);
      throw e;
    }).finally(() => {
      testBooting = null;
    });
    testBooting.catch(() => {
    });
    return testBooting;
  }
  function warmTestPlayer() {
    const pre = testEls();
    if (pre) pre.mode.classList.add("warm");
    if (!ensureTestPlayer()) {
      if (pre) pre.mode.classList.remove("warm");
      return;
    }
    bootTestMovie();
  }
  function testEls() {
    const sh = S.shadow;
    if (!sh) return null;
    const editor = sh.querySelector(".editor");
    const mode = sh.querySelector(".testmode");
    const holder = sh.querySelector(".ruffle-holder");
    if (!editor || !mode || !holder) return null;
    return { editor, mode, holder };
  }
  var stagedCSV = null;
  function publishStagedCSV(csv) {
    stagedCSV = csv;
    try {
      window.__swfGetStagedLevel = () => stagedCSV;
    } catch (_) {
    }
  }
  publishStagedCSV(null);
  var preStageTimer = null;
  function markDirty() {
    if (preStageTimer) clearTimeout(preStageTimer);
    preStageTimer = setTimeout(() => {
      preStageTimer = null;
      publishStagedCSV(levelValid() ? levelCSV() : null);
    }, 500);
  }
  function cancelPreStage() {
    if (preStageTimer) {
      clearTimeout(preStageTimer);
      preStageTimer = null;
    }
  }
  async function doTest() {
    if (!levelValid()) return;
    const els = testEls();
    if (!els || els.mode.classList.contains("active")) return;
    if (!ensureTestPlayer()) return;
    const csv = levelCSV();
    cancelPreStage();
    publishStagedCSV(csv);
    els.editor.classList.add("hidden");
    els.mode.classList.remove("warm");
    els.mode.classList.add("active");
    setTestVolume(1);
    callEditorStartAudio();
    bootTestMovie().catch(() => {
      stopTest();
    });
  }
  function stopTest() {
    const els = testEls();
    if (!els) return;
    if (els) {
      els.mode.classList.remove("active");
      els.editor.classList.remove("hidden");
    }
    publishStagedCSV(null);
    if (testPlayer) {
      els.mode.classList.add("warm");
      setTestVolume(0);
      bootTestMovie(true);
    } else {
      els.mode.classList.remove("warm");
    }
    resizeCanvas();
    draw();
  }
  function doFullscreen() {
    const el = S.shadow.host;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }
  function doClearAll() {
    if (!confirm("Clear entire level? This cannot be undone.")) return;
    initGrid();
    S.selectedObjIdx = -1;
    updateCounter();
    markDirty();
    draw();
  }
  function resizeCanvas() {
    if (!S.canvas || !S.canvasWrap || !S.grid.length) return;
    const viewW = S.canvasWrap.clientWidth, viewH = S.canvasWrap.clientHeight;
    if (viewW > 0 && viewH > 0) {
      S.canvas.width = viewW;
      S.canvas.height = viewH;
      const inner = S.shadow.querySelector(".canvas-inner");
      if (inner) {
        inner.style.width = S.grid[0].length * cellSize() + "px";
        inner.style.height = S.grid.length * cellSize() + "px";
      }
    }
    draw();
  }
  function setZoom(z) {
    S.zoom = z;
    S.shadow.querySelectorAll("[data-zoom]").forEach((b) => {
      b.classList.toggle("btn-active", parseFloat(b.getAttribute("data-zoom") || "0") === z);
    });
    resizeCanvas();
  }

  // ts/events.ts
  function onMouseDown(e) {
    e.preventDefault();
    const { bx, by, px, py, mx, my } = canvasToWorld(e);
    if (S.spaceHeld || e.button === 1) {
      S.panning = true;
      S.panStartX = e.clientX;
      S.panStartY = e.clientY;
      S.panStartSX = S.canvasWrap.scrollLeft;
      S.panStartSY = S.canvasWrap.scrollTop;
      S.canvas.style.cursor = "grabbing";
      return;
    }
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
    if (S.activeTab === "tiles" && e.button === 0 && !S.paletteDrag) {
      const hit = objectHitIndex(mx, my);
      if (hit >= 0) {
        S.selectedObjIdx = hit;
        const o = S.objects[hit];
        S.dragObj = o;
        S.dragOffX = px - o.x;
        S.dragOffY = py - o.y;
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
    if (S.activeTab !== "tiles") {
      const found = objectHitIndex(mx, my);
      S.selectedObjIdx = found;
      if (found >= 0) {
        const o = S.objects[found];
        S.dragObj = o;
        S.dragOffX = px - o.x;
        S.dragOffY = py - o.y;
        S.selectedTileBx = -1;
        S.selectedTileBy = -1;
      } else {
        S.dragObj = null;
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
  function onMouseMove(e) {
    const { bx, by, px, py, mx, my } = canvasToWorld(e);
    const hbx = inGrid(bx, by) ? bx : -1;
    const hby = inGrid(bx, by) ? by : -1;
    S.hoverBx = hbx;
    S.hoverBy = hby;
    if (S.panning) {
      S.canvasWrap.scrollLeft = S.panStartSX - (e.clientX - S.panStartX);
      S.canvasWrap.scrollTop = S.panStartSY - (e.clientY - S.panStartY);
      requestDraw();
      return;
    }
    S.canvas.style.cursor = S.spaceHeld ? "grab" : hitTileBadge(mx, my, cellSize()) ? "pointer" : "crosshair";
    if (S.dragObj && S.selectedObjIdx >= 0) {
      S.dragObj.x = snap8(px - S.dragOffX);
      S.dragObj.y = snap8(py - S.dragOffY);
      updateCounter();
    }
    if (S.paletteDrag) {
      S.previewOnCanvas = inGrid(bx, by);
      S.previewPX = snap8(px);
      S.previewPY = snap8(py);
    }
    requestDraw();
    ensureGlowLoop();
  }
  function onMouseUp(_e) {
    S.panning = false;
    S.dragObj = null;
    S.canvas.style.cursor = S.spaceHeld ? "grab" : "crosshair";
    draw();
  }
  function onMouseLeave() {
    S.panning = false;
    S.dragObj = null;
    S.hoverBx = -1;
    S.hoverBy = -1;
    S.previewOnCanvas = false;
    S.canvas.style.cursor = S.spaceHeld ? "grab" : "crosshair";
    draw();
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  function onKeyDown(e) {
    if (e.target?.classList?.contains("start-name")) return;
    if (e.code === "Space" && !S.spaceHeld) {
      e.preventDefault();
      S.spaceHeld = true;
      S.canvas.style.cursor = "grab";
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (S.selectedObjIdx >= 0) {
        S.objects.splice(S.selectedObjIdx, 1);
        S.selectedObjIdx = -1;
        updateCounter();
        markDirty();
        draw();
      } else if (S.selectedTileBx >= 0 && S.selectedTileBy >= 0 && S.selectedTileBy < S.grid.length && S.selectedTileBx < S.grid[0].length) {
        S.grid[S.selectedTileBy][S.selectedTileBx] = 0;
        S.selectedTileBx = -1;
        S.selectedTileBy = -1;
        updateCounter();
        markDirty();
        draw();
      }
    }
  }
  function onKeyUp(e) {
    if (e.target?.classList?.contains("start-name")) return;
    if (e.code === "Space") {
      S.spaceHeld = false;
      S.canvas.style.cursor = "crosshair";
    }
  }
  var canvasDrawPending = false;
  function redrawCanvasOnScroll() {
    if (canvasDrawPending) return;
    canvasDrawPending = true;
    requestAnimationFrame(() => {
      draw();
      canvasDrawPending = false;
    });
  }
  function onWheel(e) {
    e.preventDefault();
    if (e.shiftKey) {
      S.canvasWrap.scrollLeft += e.deltaY;
    } else {
      S.canvasWrap.scrollLeft += e.deltaX;
      S.canvasWrap.scrollTop += e.deltaY;
    }
    redrawCanvasOnScroll();
  }
  function onThumbstripWheel(e) {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    S.thumbstrip.scrollLeft += d;
  }
  var ghostEvent = null;
  var ghostQueued = false;
  function onDocMouseMove(e) {
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
  function onDocMouseUp(e) {
    hideGhost();
    if (!S.paletteDrag) return;
    const path = typeof e.composedPath === "function" ? e.composedPath() : null;
    const releasedOnCanvas = (path && path.length > 0 ? path[0] : e.target) === S.canvas;
    const { bx, by, px, py } = canvasToWorld(e);
    if (releasedOnCanvas && inGrid(bx, by)) {
      if (S.activeTab === "tiles") {
        S.grid[by][bx] = S.paletteDragTile;
      } else if (S.paletteDragDef) {
        const def = S.paletteDragDef;
        if ((def.id === 151 || def.id === 44) && S.objects.some((o) => o.type === def.id)) {
        } else if (totalObjects() >= countPlacedTiles()) {
        } else if (objectsInTile(bx, by) + objectTileCost(def.id, def.sub ?? 0) > MAX_OBJECTS_PER_TILE) {
        } else {
          const ox = snap8(px), oy = snap8(py);
          S.objects.push({ x: ox, y: oy, variant: def.variant ?? 0, type: def.id, sub: def.sub ?? 0 });
          S.selectedObjIdx = S.objects.length - 1;
        }
      }
      updateCounter();
      markDirty();
    }
    S.paletteDrag = false;
    S.paletteDragDef = null;
    draw();
  }
  function wireEvents() {
    const { canvas, canvasWrap, shadow, thumbstrip } = S;
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    shadow.querySelectorAll("[data-zoom]").forEach((b) => {
      b.addEventListener("click", () => setZoom(parseFloat(b.getAttribute("data-zoom") || "1")));
    });
    shadow.querySelectorAll(".tab").forEach((b) => {
      b.addEventListener("click", () => switchTab(b.getAttribute("data-tab")));
    });
    shadow.querySelectorAll("[data-action]").forEach((b) => {
      b.addEventListener("click", () => {
        const a = b.getAttribute("data-action");
        if (a === "save") doSave();
        else if (a === "test") doTest();
        else if (a === "stoptest") stopTest();
        else if (a === "fullscreen") doFullscreen();
        else if (a === "mylevels") location.href = "/editors/?action=myLevels&gamegroupid=52";
        else if (a === "alllevels") location.href = "/editors/?action=editorDetail&gamegroupid=52";
        else if (a === "startcreating") doStartCreating();
      });
    });
    shadow.querySelector(".start-name")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doStartCreating();
    });
    shadow.querySelector(".btn-clear")?.addEventListener("click", doClearAll);
    window.addEventListener("resize", resizeCanvas);
    canvasWrap?.addEventListener("scroll", redrawCanvasOnScroll);
    thumbstrip?.addEventListener("wheel", onThumbstripWheel, { passive: false });
  }

  // ts/main.ts
  var SCRIPT_T0 = performance.now();
  console.log(`[editor:timing] bundle executed readyState=${document.readyState}`);
  function timingLog(tag) {
    console.log(`[editor:timing] ${tag} +${Math.round(performance.now() - SCRIPT_T0)}ms`);
  }
  function resourceMs(name) {
    const entries = performance.getEntriesByType("resource");
    const hit = entries.filter((e) => e.name.endsWith(name)).pop();
    return hit ? ` (net ${Math.round(hit.responseEnd - hit.startTime)}ms)` : "";
  }
  function boot() {
    timingLog(`boot DOMContentLoaded readyState=${document.readyState}`);
    console.log("[editor] build 20260913T1849 (object subtypes + thumb-blit canvas)");
    const host = document.getElementById("gamecontainer");
    if (!host) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/").then((r) => {
        try {
          r?.unregister();
        } catch (_) {
        }
      }).catch(() => {
      });
    }
    const shadow = host.attachShadow({ mode: "open" });
    S.shadow = shadow;
    const style = document.createElement("style");
    style.textContent = EDITOR_CSS;
    shadow.appendChild(style);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "height:100%;display:flex;flex-direction:column;position:relative;";
    wrapper.innerHTML = EDITOR_HTML;
    shadow.appendChild(wrapper);
    S.canvas = shadow.querySelector("canvas.display");
    S.ctx = S.canvas.getContext("2d");
    S.canvasWrap = shadow.querySelector(".canvas-wrap");
    S.thumbstrip = shadow.querySelector(".thumbstrip");
    S.descEl = shadow.querySelector(".desc");
    S.counterEl = shadow.querySelector(".counter");
    S.ghostEl = shadow.querySelector("#ghost");
    initGrid();
    initGhostCanvas();
    S.spritesheetImg = new Image();
    S.spritesheetImg.onload = () => {
      timingLog(`spritesheet onload${resourceMs("/editors/assets/spritesheet.png")}`);
      buildThumbnails();
      draw();
      warmOnce();
    };
    S.spritesheetImg.onerror = () => {
      timingLog("spritesheet onerror \u2014 warming test player anyway");
      warmOnce();
    };
    setTimeout(warmOnce, 15e3);
    timingLog("spritesheet fetch start");
    S.spritesheetImg.src = "/editors/assets/spritesheet.png";
    S.gloweyImg = new Image();
    S.gloweyImg.onload = () => {
      draw();
    };
    S.gloweyImg.src = "/editors/assets/glowey.png";
    preloadSprites(() => {
      buildThumbnails();
      draw();
    });
    wireEvents();
    const nameInput = shadow.querySelector(".start-name");
    nameInput?.focus();
    nameInput?.select();
    requestAnimationFrame(() => {
      resizeCanvas();
      updateCounter();
      switchTab("tiles");
      timingLog("first paint (tiles tab)");
    });
  }
  var warmed = false;
  function warmOnce() {
    if (warmed) return;
    warmed = true;
    timingLog("test-player warmup start");
    warmTestPlayer();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
