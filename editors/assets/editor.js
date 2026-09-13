(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

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
  var RING_TYPES = [
    { id: 0, name: "Ring Row", desc: "Horizontal ring line (+X)", isRing: true, ringLayout: 0 },
    { id: 1, name: "Ring Column", desc: "Vertical ring line (+Y)", isRing: true, ringLayout: 1 },
    { id: 63, name: "Ring Diag -16", desc: "Diagonal ring line (-16/+16)", isRing: true, ringLayout: 63 },
    { id: 64, name: "Ring Diag +16", desc: "Diagonal ring line (+16/+16)", isRing: true, ringLayout: 64 },
    { id: 65, name: "Ring Diag +32", desc: "Diagonal ring line (+32/+32)", isRing: true, ringLayout: 65 },
    { id: 66, name: "Ring Horiz 16", desc: "Horizontal ring line 16px", isRing: true, ringLayout: 66 },
    { id: 67, name: "Ring Horiz 32", desc: "Horizontal ring line 32px", isRing: true, ringLayout: 67 },
    { id: 68, name: "Ring Vert 16", desc: "Vertical ring line 16px", isRing: true, ringLayout: 68 },
    { id: 69, name: "Ring Vert 32", desc: "Vertical ring line 32px", isRing: true, ringLayout: 69 }
  ];
  var OBJECTS = [
    { id: 2, name: "Red Spring", desc: "Red spring pad (bounces up)" },
    { id: 153, name: "Yellow Spring", desc: "Yellow spring pad (bounces up)" },
    { id: 9, name: "Spikes", desc: "Spike trap" },
    { id: 15, name: "Switch", desc: "Activates connected objects" },
    { id: 45, name: "Button", desc: "Button / base plate" },
    { id: 46, name: "Bten Switch", desc: "Button variant (drawn in-game only when sub=1)" },
    { id: 42, name: "Item Pickup", desc: "Monitor power-up placed directly" },
    { id: 43, name: "Item Pickup S", desc: "Monitor power-up placed directly (stock GH uses this)" },
    { id: 4, name: "Tall Bridge", desc: "Tall bridge / pole" },
    { id: 5, name: "Bridge", desc: "Standard bridge" },
    { id: 38, name: "Bridge Edge", desc: "Bridge end decoration (static)" },
    { id: 6, name: "Breakable Wall", desc: "Breakable wall segment" },
    { id: 18, name: "Breakable Wall GH", desc: "Breakable wall (Green Hill)" },
    { id: 3, name: "Swing", desc: "Swinging platform" },
    { id: 16, name: "Shima Platform", desc: "Green Hill floating platform" },
    { id: 90, name: "Shima Pillar", desc: "Tall Green Hill platform variant" },
    { id: 37, name: "Kageb Block", desc: "Green Hill block gimmick" },
    { id: 58, name: "Jyama", desc: "Green Hill gimmick" }
  ];
  var ENEMIES = [
    { id: 41, name: "Musi", desc: "Bug badnik (crawls on surfaces)" },
    { id: 40, name: "Hachi", desc: "Bee badnik (flies in patterns)" },
    { id: 86, name: "Fish Chopper", desc: "Chopper fish (jumps from water)" },
    { id: 39, name: "Kamere", desc: "Chameleon badnik (spits fireballs)" },
    { id: 57, name: "Kani", desc: "Crab badnik (walks and pinches)" }
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
    const entries = [];
    for (const obj of objects) {
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
  function countObjectsInTile(objects, tileCol, tileRow) {
    let count = 0;
    for (const obj of objects) {
      const tc = Math.floor(obj.x / BLOCK_PX);
      const tr = Math.floor(obj.y / BLOCK_PX);
      if (tc === tileCol && tr === tileRow) {
        count += obj.type <= 1 || obj.type >= 63 && obj.type <= 69 ? 1 + obj.sub : 1;
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
    zoom: 2,
    spaceHeld: false,
    selectedObjIdx: -1,
    dragObj: null,
    dragOffX: 0,
    dragOffY: 0,
    // Palette drag (started from thumbnail, ends on canvas)
    paletteDrag: false,
    paletteDragTile: 0,
    paletteDragDef: null,
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
    statusEl: null,
    counterEl: null,
    canvasWrap: null,
    ghostEl: null
  };
  function cellSize() {
    return Math.round(64 * S.zoom);
  }
  function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    S.grid = [];
    for (let r = 0; r < rows; r++) S.grid.push(new Array(cols).fill(0));
    S.objects = [];
    S.selectedObjIdx = -1;
  }
  function inGrid(bx, by) {
    return bx >= 0 && bx < S.grid[0].length && by >= 0 && by < S.grid.length;
  }
  function setStatus(msg) {
    if (S.statusEl) S.statusEl.textContent = msg;
  }
  function updateDesc(text) {
    if (S.descEl) S.descEl.textContent = text;
  }
  function canvasToWorld(e) {
    const rect = S.canvas.getBoundingClientRect();
    const cs = cellSize();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    return {
      bx: Math.floor(mx / cs),
      by: Math.floor(my / cs),
      px: Math.floor(mx / cs * BLOCK_PX),
      py: Math.floor(my / cs * BLOCK_PX)
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
    let c = 0;
    for (const o of S.objects) c += o.type <= 1 || o.type >= 63 && o.type <= 69 ? 1 + o.sub : 1;
    return c;
  }
  function countPlacedTiles() {
    let c = 0;
    for (const row2 of S.grid) for (const id of row2) if (id > 0) c++;
    return c;
  }
  function findDef(typeId) {
    for (const arr of [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES])
      for (const d of arr) if (d.id === typeId) return d;
    return null;
  }

  // ts/ui.ts
  var EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; margin: 0; padding: 0; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  margin: 0; padding: 0;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: #2a2a2a; overflow: hidden; user-select: none;
  border-radius: 0 0 10px 10px; }

/* \u2500\u2500 top bar \u2500\u2500 */
.topbar { display: flex; align-items: center; justify-content: space-between;
  margin: 0; padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
.topbar-l, .topbar-r { display: flex; align-items: center; gap: 6px; }
.topbar label { font-size: 12px; }
.btn { padding: 2px 8px; border: 1px solid #666; background: #555; color: #fff;
  cursor: pointer; font-size: 11px; font-family: inherit; }
.btn:hover { background: #777; }
.btn-active { background: #0a0; border-color: #0f0; }
.btn-clear { background: #633; border-color: #a44; }
.btn-clear:hover { background: #944; }

/* \u2500\u2500 main split: canvas on top, tabs+options below \u2500\u2500 */
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; }

/* \u2500\u2500 canvas area \u2500\u2500 */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.canvas-wrap { flex: 1; overflow: auto; background: #d4e8c0; min-height: 0; }
canvas.display { display: block; cursor: crosshair; }

/* \u2500\u2500 bottom: tabs + options (25% height) \u2500\u2500 */
.bottom { display: flex; height: 25%; min-height: 140px; border-top: 2px solid #555; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  border-right: 1px solid #555; background: #ddd; }
.tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid #999; }
.tab { padding: 4px 10px; border: 1px solid #999; border-bottom: none;
  background: #ccc; cursor: pointer; font-size: 11px; font-family: inherit; }
.tab:hover { background: #ddd; }
.tab-active { background: #fff; font-weight: bold; }
.thumbstrip { flex: 1; display: flex; gap: 3px; padding: 4px;
  overflow-x: auto; overflow-y: hidden; align-items: stretch; }
.thumb { height: 100%; aspect-ratio: 1; border: 1px solid #888; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
.thumb:hover { border-color: #f00; }
.thumb canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated;
  image-rendering: crisp-edges; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }
.desc { height: 20px; padding: 2px 6px; background: #f0f0f0; border-top: 1px solid #ccc;
  font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 8px;
  background: #eee; gap: 6px; }
.panel-right h4 { margin: 0 0 2px 0; font-size: 13px; }
.act-btn { padding: 6px 10px; border: 1px solid #888; background: #ddd;
  cursor: pointer; font-size: 12px; width: 100%; text-align: center;
  font-family: inherit; }
.act-btn:hover { background: #ccc; }
.status { margin-top: auto; padding: 4px; background: #fff; border: 1px solid #ccc;
  font-size: 11px; min-height: 20px; word-wrap: break-word; }

/* \u2500\u2500 bottom bar \u2500\u2500 */
.bottombar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
.bottombar-l { display: flex; gap: 6px; }
.btm-btn { padding: 3px 10px; border: 1px solid #666; background: #555; color: #fff;
  cursor: pointer; font-size: 11px; font-family: inherit; }
.btm-btn:hover { background: #777; }

/* \u2500\u2500 floating ghost \u2500\u2500 */
.ghost { display: none; position: fixed; pointer-events: none; z-index: 9999;
  opacity: 0.7; border: 2px dashed #fff; background-color: rgba(0,0,0,0.3);
  image-rendering: pixelated; }
.ghost.visible { display: block; }
`;
  var EDITOR_HTML = `
<div class="editor">
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
      <button class="btn btn-clear" title="Clear entire level">X</button>
    </div>
  </div>

  <div class="main">
    <div class="canvas-area">
      <div class="canvas-wrap">
        <canvas class="display"></canvas>
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
        <div class="desc">Select an item below</div>
      </div>
      <div class="panel-right">
        <h4>Options</h4>
        <button class="act-btn" data-action="test">Test Level</button>
        <button class="act-btn" data-action="save">Save</button>
        <button class="act-btn" data-action="fullscreen">Go Fullscreen</button>
        <div class="status">Ready</div>
      </div>
    </div>
  </div>

  <div class="bottombar">
    <div class="bottombar-l">
      <button class="btm-btn" data-action="mylevels">My Levels</button>
      <button class="btm-btn" data-action="alllevels">All Levels</button>
    </div>
    <button class="btm-btn" data-action="share">SHARE</button>
  </div>

  <div class="ghost" id="ghost"></div>
</div>
`;

  // ts/sprites.ts
  var D = "/games/swf/52/res/images/default/";
  var G = "/games/swf/52/res/images/zone_greenhill/";
  function p(img, sx, sy, w, h, ox, oy, anchor) {
    return { img, sx, sy, w, h, ox, oy, anchor };
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
    153: [p(D + "sjump2.png", 0, 0, 32, 16, 0, 8, "bottomcenter")],
    // framedata[153][0]
    // Spikes default (var 0): full sheet centered (spike_draw else-branch)
    9: [p(D + "toge.png", 0, 0, 40, 32, 0, 0, "center")],
    // Tall bridge: 12 animated 16x24 segments, idle row 0 (thorn_draw)
    4: row(G + "thashi.png", 0, 0, 16, 24),
    // Bridge: 12 segments of cell (32,0,16,16), idle sag 0 (bridge_draw)
    5: row(G + "hashi.png", 32, 0, 16, 16),
    // Breakable wall idle: whole 96x96 sheet, center at (x, y-8) (break_draw)
    6: [p(G + "break.png", 0, 0, 96, 96, 0, -8, "center")],
    // GH breakable idle (var 0): two 16x16 columns, TOP|LEFT (breakable_draw)
    18: [
      p(G + "brkabe_g.png", 0, 0, 16, 16, -16, -32, "topleft"),
      p(G + "brkabe_g.png", 16, 0, 16, 16, 0, -32, "topleft")
    ],
    // Swing seat (GH branch): cell (16,16,16,16) at origin (swinging_platform_draw)
    3: [p(D + "buranko.png", 16, 16, 16, 16, 0, 0, "center")],
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
  function ringParts(type, sub) {
    var _a;
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
    const [dx, dy] = (_a = steps[type]) != null ? _a : [0, 0];
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push(__spreadProps(__spreadValues({}, base), { ox: base.ox + i * dx, oy: base.oy + i * dy }));
    }
    return parts;
  }
  var RING_TYPES2 = /* @__PURE__ */ new Set([0, 1, 63, 64, 65, 66, 67, 68, 69]);
  function partsFor(type, sub) {
    if (!(type in SPRITES)) return null;
    if (RING_TYPES2.has(type)) return ringParts(type, sub);
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
    const urls = /* @__PURE__ */ new Set();
    for (const t of Object.keys(SPRITES)) {
      for (const part of SPRITES[Number(t)]) urls.add(part.img);
    }
    for (const url of urls) {
      const img = spriteImg(url);
      if (img.complete) continue;
      img.onload = onOneReady;
    }
  }
  function spriteBBox(parts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of parts) {
      let px = part.ox, py = part.oy;
      if (part.anchor === "center") {
        px -= part.w / 2;
        py -= part.h / 2;
      } else if (part.anchor === "bottomcenter") {
        px -= part.w / 2;
        py -= part.h;
      }
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px + part.w);
      y1 = Math.max(y1, py + part.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function drawParts(ctx, parts, gx, gy, k) {
    ctx.imageSmoothingEnabled = false;
    for (const part of parts) {
      const img = spriteImg(part.img);
      if (!img.complete || img.naturalWidth === 0) continue;
      const ax = (gx + part.ox) * k, ay = (gy + part.oy) * k;
      const dw = part.w * k, dh = part.h * k;
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
  }
  function spriteScale(cellSize4) {
    return cellSize4 / BLOCK_PX;
  }
  function paintFitted(c, parts, size = 256, pad = 8) {
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
  var thumbURLCache = /* @__PURE__ */ new Map();
  function spriteThumbURL(typeId) {
    const parts = partsFor(typeId, 0);
    if (!parts) return null;
    const hit = thumbURLCache.get(typeId);
    if (hit) return hit;
    const cvs = document.createElement("canvas");
    cvs.width = 256;
    cvs.height = 256;
    if (!paintFitted(cvs.getContext("2d"), parts)) return null;
    const url = cvs.toDataURL();
    thumbURLCache.set(typeId, url);
    return url;
  }

  // ts/render.ts
  var GHOST_PX = 256;
  var ghostCanvas;
  var ghostCtx;
  function initGhostCanvas() {
    ghostCanvas = document.createElement("canvas");
    ghostCanvas.width = GHOST_PX;
    ghostCanvas.height = GHOST_PX;
    ghostCtx = ghostCanvas.getContext("2d");
  }
  function draw() {
    const { ctx, canvas: cvs, canvasWrap, grid, objects, spritesheetImg } = S;
    if (!ctx || !cvs || !canvasWrap) return;
    const W = cvs.width, H = cvs.height, cs = cellSize();
    const scrollX = canvasWrap.scrollLeft, scrollY = canvasWrap.scrollTop;
    const viewW = canvasWrap.clientWidth || W, viewH = canvasWrap.clientHeight || H;
    ctx.fillStyle = "#d4e8c0";
    ctx.fillRect(0, 0, W, H);
    const c0 = Math.max(0, Math.floor(scrollX / cs) - 1);
    const r0 = Math.max(0, Math.floor(scrollY / cs) - 1);
    const c1 = Math.min(grid[0].length, Math.ceil((scrollX + viewW) / cs) + 1);
    const r1 = Math.min(grid.length, Math.ceil((scrollY + viewH) / cs) + 1);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const id = grid[r][c];
        const dx = c * cs, dy = r * cs;
        if (id > 0 && id < TOTAL_BLOCKS && (spritesheetImg == null ? void 0 : spritesheetImg.complete)) {
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
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let r = r0; r <= r1; r++) {
      const y = Math.round(r * cs) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let c = c0; c <= c1; c++) {
      const x = Math.round(c * cs) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const k = spriteScale(cs);
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const isSel = i === S.selectedObjIdx;
      const parts = partsFor(obj.type, obj.sub);
      if (parts) {
        const bb = spriteBBox(parts);
        const bx0 = (obj.x + bb.x) * k, by0 = (obj.y + bb.y) * k;
        const bw = bb.w * k, bh = bb.h * k;
        if (bx0 + bw < scrollX || bx0 > scrollX + viewW || by0 + bh < scrollY || by0 > scrollY + viewH) continue;
        drawParts(ctx, parts, obj.x, obj.y, k);
        if (isSel) {
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
  }
  function updateGhost(e) {
    const { ghostEl, spritesheetImg, activeTab } = S;
    if (!ghostEl) return;
    if (!S.paletteDrag) {
      hideGhost();
      return;
    }
    const cs = cellSize();
    ghostEl.classList.add("visible");
    ghostEl.style.width = cs + "px";
    ghostEl.style.height = cs + "px";
    ghostEl.style.left = e.clientX - cs / 2 + "px";
    ghostEl.style.top = e.clientY - cs / 2 + "px";
    if (activeTab === "tiles" && (spritesheetImg == null ? void 0 : spritesheetImg.complete)) {
      ghostCtx.clearRect(0, 0, GHOST_PX, GHOST_PX);
      const { x: sx, y: sy } = blockSheetXY(S.paletteDragTile);
      ghostCtx.imageSmoothingEnabled = false;
      ghostCtx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, GHOST_PX, GHOST_PX);
      ghostEl.style.backgroundImage = `url(${ghostCanvas.toDataURL()})`;
      ghostEl.style.backgroundSize = "100% 100%";
      ghostEl.style.display = "";
    } else if (S.paletteDragDef) {
      const url = spriteThumbURL(S.paletteDragDef.id);
      if (url) {
        ghostEl.style.backgroundImage = `url(${url})`;
        ghostEl.style.backgroundSize = "contain";
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
  }
  function hideGhost() {
    const { ghostEl } = S;
    if (!ghostEl) return;
    ghostEl.classList.remove("visible");
    ghostEl.style.display = "";
  }

  // ts/thumbnails.ts
  function updateCounter() {
    var _a;
    if (!S.counterEl) return;
    const totalTiles = S.grid.length * (((_a = S.grid[0]) == null ? void 0 : _a.length) || 0);
    const placedTiles = countPlacedTiles();
    S.counterEl.textContent = `${totalObjects()}/${placedTiles}`;
  }
  function buildThumbnails() {
    const { thumbstrip, spritesheetImg, activeTab } = S;
    if (!thumbstrip) return;
    thumbstrip.innerHTML = "";
    if (activeTab === "tiles") {
      for (let i = 1; i <= 107 && i < USED_BLOCKS; i++) {
        if (i === 7) continue;
        const el = document.createElement("div");
        el.className = "thumb";
        el.title = `Block ${i}`;
        const cvs = document.createElement("canvas");
        cvs.width = BLOCK_PX;
        cvs.height = BLOCK_PX;
        const c = cvs.getContext("2d");
        if (spritesheetImg == null ? void 0 : spritesheetImg.complete) {
          const { x: sx, y: sy } = blockSheetXY(i);
          c.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, BLOCK_PX, BLOCK_PX);
        }
        el.appendChild(cvs);
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          S.selectedTile = i;
          S.selectedObj = null;
          S.selectedObjIdx = -1;
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
        const noArt = !partsFor(def.id, 0);
        el.title = def.desc + (noArt ? " (invisible in-game: no art in this zone)" : "");
        const parts = partsFor(def.id, 0);
        if (parts) {
          el.className = "thumb";
          const cvs = document.createElement("canvas");
          cvs.width = BLOCK_PX;
          cvs.height = BLOCK_PX;
          paintFitted(cvs.getContext("2d"), parts);
          el.appendChild(cvs);
        } else {
          el.className = "thumb thumb-txt";
          el.textContent = def.name;
        }
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          S.selectedObj = def;
          S.selectedObjIdx = -1;
          S.paletteDrag = true;
          S.paletteDragDef = def;
          updateDesc(`${def.name}: ${def.desc}` + (noArt ? " (invisible in-game: no art in this zone)" : ""));
          draw();
        });
        thumbstrip.appendChild(el);
      }
    }
  }
  function switchTab(tab) {
    S.activeTab = tab;
    S.selectedObj = null;
    S.selectedObjIdx = -1;
    S.shadow.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("tab-active", b.getAttribute("data-tab") === tab);
    });
    buildThumbnails();
    updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab \u2014 select an item below`);
    draw();
  }

  // ts/actions.ts
  function hasSonic() {
    return S.objects.some((o) => o.type === 151);
  }
  function hasGoal() {
    return S.objects.some((o) => o.type === 44);
  }
  async function doSave() {
    const sonics = S.objects.filter((o) => o.type === 151).length;
    const goals = S.objects.filter((o) => o.type === 44).length;
    if (sonics === 0) {
      setStatus("Error: Sonic Placer (spawn) is required!");
      return;
    }
    if (goals === 0) {
      setStatus("Error: Sign Post (goal) is required!");
      return;
    }
    if (sonics > 1) {
      setStatus("Error: Only one Sonic Placer allowed (game uses the last)!");
      return;
    }
    if (goals > 1) {
      setStatus("Error: Only one Sign Post allowed!");
      return;
    }
    setStatus("Saving...");
    try {
      const bin = encodeBin(S.grid);
      const act = encodeAct(S.objects);
      const resp = await fetch("/editors/save.php", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: toCSV(bin, act)
      });
      const r = await resp.json();
      setStatus(r.ok ? `Saved! (${r.binBytes}B BIN + ${r.actBytes}B ACT)` : `Save error: ${r.error}`);
    } catch (err) {
      setStatus(`Save failed: ${err.message}`);
    }
  }
  async function doTest() {
    if (!hasSonic() || !hasGoal()) {
      setStatus("Error: Sonic Placer + Sign Post required to test!");
      return;
    }
    await doSave();
    window.open("/", "_blank");
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
    setStatus("Level cleared");
    updateCounter();
    draw();
  }
  function resizeCanvas() {
    if (!S.canvas) return;
    S.canvas.width = S.grid[0].length * cellSize();
    S.canvas.height = S.grid.length * cellSize();
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
    const { bx, by, px, py } = canvasToWorld(e);
    if (S.spaceHeld || e.button === 1) {
      S.panning = true;
      S.panStartX = e.clientX;
      S.panStartY = e.clientY;
      S.panStartSX = S.canvasWrap.scrollLeft;
      S.panStartSY = S.canvasWrap.scrollTop;
      S.canvas.style.cursor = "grabbing";
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
      updateCounter();
      draw();
      return;
    }
    if (S.activeTab !== "tiles") {
      let found = -1;
      for (let i = S.objects.length - 1; i >= 0; i--) {
        const o = S.objects[i];
        if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
          found = i;
          break;
        }
      }
      S.selectedObjIdx = found;
      if (found >= 0) {
        const o = S.objects[found];
        S.dragObj = o;
        S.dragOffX = px - o.x;
        S.dragOffY = py - o.y;
        setStatus(`Selected: ${findDefName(o.type)} at (${o.x},${o.y})`);
      } else {
        S.dragObj = null;
        setStatus("");
      }
      updateCounter();
      draw();
    }
  }
  function onMouseMove(e) {
    if (S.panning) {
      S.canvasWrap.scrollLeft = S.panStartSX - (e.clientX - S.panStartX);
      S.canvasWrap.scrollTop = S.panStartSY - (e.clientY - S.panStartY);
      draw();
      return;
    }
    const { bx, by, px, py } = canvasToWorld(e);
    if (S.dragObj && S.selectedObjIdx >= 0) {
      S.dragObj.x = snap8(px - S.dragOffX);
      S.dragObj.y = snap8(py - S.dragOffY);
      updateCounter();
    }
    draw();
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
    S.canvas.style.cursor = S.spaceHeld ? "grab" : "crosshair";
    draw();
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  function onKeyDown(e) {
    if (e.code === "Space" && !S.spaceHeld) {
      e.preventDefault();
      S.spaceHeld = true;
      S.canvas.style.cursor = "grab";
    }
    if ((e.key === "Delete" || e.key === "Backspace") && S.selectedObjIdx >= 0) {
      S.objects.splice(S.selectedObjIdx, 1);
      S.selectedObjIdx = -1;
      setStatus("Deleted");
      updateCounter();
      draw();
    }
  }
  function onKeyUp(e) {
    if (e.code === "Space") {
      S.spaceHeld = false;
      S.canvas.style.cursor = "crosshair";
    }
  }
  function onWheel(e) {
    e.preventDefault();
    if (e.shiftKey) {
      S.canvasWrap.scrollLeft += e.deltaY;
    } else {
      S.canvasWrap.scrollLeft += e.deltaX;
      S.canvasWrap.scrollTop += e.deltaY;
    }
  }
  function onDocMouseMove(e) {
    updateGhost(e);
  }
  function onDocMouseUp(e) {
    hideGhost();
    if (!S.paletteDrag) return;
    const { bx, by, px, py } = canvasToWorld(e);
    if (inGrid(bx, by)) {
      if (S.activeTab === "tiles") {
        S.grid[by][bx] = S.paletteDragTile;
        setStatus(`Placed block ${S.paletteDragTile} at (${bx},${by})`);
      } else if (S.paletteDragDef) {
        const def = S.paletteDragDef;
        if ((def.id === 151 || def.id === 44) && S.objects.some((o) => o.type === def.id)) {
          setStatus(`Only one ${def.name} per level!`);
        } else if (totalObjects() >= countPlacedTiles()) {
          setStatus("Max object limit reached!");
        } else if (objectsInTile(bx, by) >= MAX_OBJECTS_PER_TILE) {
          setStatus(`Max ${MAX_OBJECTS_PER_TILE} objects per tile!`);
        } else {
          const ox = snap8(px), oy = snap8(py);
          S.objects.push({ x: ox, y: oy, variant: 0, type: def.id, sub: 0 });
          const buried = S.grid[by][bx] !== 0;
          setStatus(`Placed ${def.name} at (${ox},${oy})` + (buried ? " \u2014 inside solid tile!" : ""));
        }
      }
      updateCounter();
    }
    S.paletteDrag = false;
    S.paletteDragDef = null;
    draw();
  }
  function findDefName(typeId) {
    const def = findDef(typeId);
    return def ? def.name : `${typeId}`;
  }
  function wireEvents() {
    var _a;
    const { canvas, canvasWrap, shadow } = S;
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
        else if (a === "fullscreen") doFullscreen();
        else if (a === "share") setStatus("SHARE \u2014 not wired yet");
        else if (a === "mylevels") location.href = "/editors/?action=myLevels&gamegroupid=52";
        else if (a === "alllevels") location.href = "/editors/?action=editorDetail&gamegroupid=52";
      });
    });
    (_a = shadow.querySelector(".btn-clear")) == null ? void 0 : _a.addEventListener("click", doClearAll);
    window.addEventListener("resize", resizeCanvas);
  }

  // ts/main.ts
  function boot() {
    const host = document.getElementById("gamecontainer");
    if (!host) return;
    const shadow = host.attachShadow({ mode: "open" });
    S.shadow = shadow;
    const style = document.createElement("style");
    style.textContent = EDITOR_CSS;
    shadow.appendChild(style);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "height:100%;display:flex;flex-direction:column;";
    wrapper.innerHTML = EDITOR_HTML;
    shadow.appendChild(wrapper);
    S.canvas = shadow.querySelector("canvas.display");
    S.ctx = S.canvas.getContext("2d");
    S.canvasWrap = shadow.querySelector(".canvas-wrap");
    S.thumbstrip = shadow.querySelector(".thumbstrip");
    S.descEl = shadow.querySelector(".desc");
    S.statusEl = shadow.querySelector(".status");
    S.counterEl = shadow.querySelector(".counter");
    S.ghostEl = shadow.querySelector(".ghost");
    initGrid();
    initGhostCanvas();
    S.spritesheetImg = new Image();
    S.spritesheetImg.onload = () => {
      buildThumbnails();
      draw();
    };
    S.spritesheetImg.src = "/editors/assets/spritesheet.png";
    preloadSprites(() => {
      buildThumbnails();
      draw();
    });
    wireEvents();
    requestAnimationFrame(() => {
      resizeCanvas();
      updateCounter();
      switchTab("tiles");
    });
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
