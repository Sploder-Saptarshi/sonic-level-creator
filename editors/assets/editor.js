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
  function findDef(typeId, variant, sub) {
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
/* Object thumbs: same forced-square box as tiles, but art inside stays at
   original 1x pixels (attribute size from paintThumb scale=1), centered,
   shrinking only if larger than the box. */
.thumb-obj canvas { width: auto; height: auto; max-width: 100%; max-height: 100%;
  object-fit: contain; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }
.desc { height: 20px; padding: 2px 6px; background: #f0f0f0; border-top: 1px solid #ccc;
  font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 8px;
  background: #eee; gap: 6px; max-width: 200px; }
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
  function partsFor(type, sub = 0, variant = 0) {
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
  function spriteBBox(parts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of parts) {
      for (const [px, py] of partCorners(part)) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
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
    const tileCs = cs / 16;
    const tc0 = Math.max(0, Math.floor(scrollX / tileCs) - 1);
    const tc1 = Math.min(grid[0].length * 16, Math.ceil((scrollX + viewW) / tileCs) + 1);
    const tr0 = Math.max(0, Math.floor(scrollY / tileCs) - 1);
    const tr1 = Math.min(grid.length * 16, Math.ceil((scrollY + viewH) / tileCs) + 1);
    for (let t = tc0; t <= tc1; t++) {
      const x = Math.round(t * tileCs) + 0.5;
      if (t % 16 === 0) {
        ctx.strokeStyle = "rgba(128,128,128,0.6)";
      } else if (t % 8 === 0) {
        ctx.strokeStyle = "rgba(128,128,128,0.3)";
      } else {
        ctx.strokeStyle = "rgba(128,128,128,0.1)";
      }
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let t = tr0; t <= tr1; t++) {
      const y = Math.round(t * tileCs) + 0.5;
      if (t % 16 === 0) {
        ctx.strokeStyle = "rgba(128,128,128,0.6)";
      } else if (t % 8 === 0) {
        ctx.strokeStyle = "rgba(128,128,128,0.3)";
      } else {
        ctx.strokeStyle = "rgba(128,128,128,0.1)";
      }
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
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
    if (activeTab === "tiles" && spritesheetImg?.complete) {
      ghostCtx.clearRect(0, 0, GHOST_PX, GHOST_PX);
      const { x: sx, y: sy } = blockSheetXY(S.paletteDragTile);
      ghostCtx.imageSmoothingEnabled = false;
      ghostCtx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, GHOST_PX, GHOST_PX);
      ghostEl.style.backgroundImage = `url(${ghostCanvas.toDataURL()})`;
      ghostEl.style.backgroundSize = "100% 100%";
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
        ghostEl.style.backgroundImage = `url(${url})`;
        ghostEl.style.backgroundSize = "100% 100%";
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
    if (!S.counterEl) return;
    const totalTiles = S.grid.length * (S.grid[0]?.length || 0);
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
        if (spritesheetImg?.complete) {
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
        const sub = def.sub ?? 0, variant = def.variant ?? 0;
        const mirror = !!def.mirror || isMirrored(def.id, variant, sub);
        const noArt = !partsFor(def.id, sub, variant);
        el.title = def.desc + (noArt ? " (invisible in-game: no art in this zone)" : "");
        const parts = partsFor(def.id, sub, variant);
        let cvs = null;
        if (parts) {
          el.className = "thumb thumb-obj";
          cvs = document.createElement("canvas");
          paintThumb(cvs.getContext("2d"), parts, 1, mirror);
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
        if (cvs) {
          const boxH = el.clientHeight - 2, boxW = el.clientWidth - 2;
          if (boxH > 0 && boxW > 0 && cvs.width > 0 && cvs.height > 0) {
            const s = Math.min(1, boxW / cvs.width, boxH / cvs.height);
            cvs.style.width = Math.max(1, Math.floor(cvs.width * s)) + "px";
            cvs.style.height = Math.max(1, Math.floor(cvs.height * s)) + "px";
          }
        }
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
        setStatus(`Selected: ${findDefName(o.type, o.variant, o.sub)} at (${o.x},${o.y})`);
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
          S.objects.push({ x: ox, y: oy, variant: def.variant ?? 0, type: def.id, sub: def.sub ?? 0 });
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
  function findDefName(typeId, variant = 0, sub = 0) {
    const def = findDef(typeId, variant, sub);
    return def ? def.name : `${typeId}`;
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
        else if (a === "fullscreen") doFullscreen();
        else if (a === "share") setStatus("SHARE \u2014 not wired yet");
        else if (a === "mylevels") location.href = "/editors/?action=myLevels&gamegroupid=52";
        else if (a === "alllevels") location.href = "/editors/?action=editorDetail&gamegroupid=52";
      });
    });
    shadow.querySelector(".btn-clear")?.addEventListener("click", doClearAll);
    window.addEventListener("resize", resizeCanvas);
    canvasWrap?.addEventListener("scroll", redrawCanvasOnScroll);
    thumbstrip?.addEventListener("wheel", onThumbstripWheel, { passive: false });
  }

  // ts/main.ts
  function boot() {
    console.log("[editor] build 20260913T1849 (object subtypes + thumb-blit canvas)");
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
