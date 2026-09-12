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
    { id: 10, name: "Monitor", desc: "Item monitor (TV box)" },
    { id: 12, name: "Platform", desc: "Static platform" },
    { id: 17, name: "Moving Platform", desc: "Moving platform (patrol)" },
    { id: 32, name: "Large Platform", desc: "Large moving platform" },
    { id: 62, name: "Platform Lamp", desc: "Platform with lamp decoration" },
    { id: 83, name: "DAI3 Platform", desc: "Alternate platform variant" },
    { id: 11, name: "Falling Block", desc: "Block that falls when stepped on" },
    { id: 15, name: "Switch", desc: "Activates connected objects" },
    { id: 22, name: "Fan", desc: "Wind fan (blows upward)" },
    { id: 24, name: "Conveyor", desc: "Conveyor belt surface" },
    { id: 33, name: "Elevator Rail", desc: "Elevator on a rail" },
    { id: 73, name: "Elevator", desc: "Standard elevator platform" },
    { id: 47, name: "Giant Ring", desc: "Giant ring (special stage entry)" },
    { id: 45, name: "Button", desc: "Button / base plate" },
    { id: 102, name: "Solid Block", desc: "Solid collision block" },
    { id: 30, name: "Door", desc: "Door / gate" },
    { id: 4, name: "Tall Bridge", desc: "Tall bridge / pole" },
    { id: 5, name: "Bridge", desc: "Standard bridge" },
    { id: 6, name: "Breakable Wall", desc: "Breakable wall segment" },
    { id: 18, name: "Breakable Wall GH", desc: "Breakable wall (Green Hill)" },
    { id: 21, name: "Steps", desc: "Step platforms" },
    { id: 3, name: "Swing", desc: "Swinging platform" },
    { id: 7, name: "Floor Block", desc: "Solid floor piece" },
    { id: 29, name: "Floor Trap", desc: "Trap floor segment" }
  ];
  var ENEMIES = [
    { id: 41, name: "Musi", desc: "Bug badnik (crawls on surfaces)" },
    { id: 40, name: "Hachi", desc: "Bee badnik (flies in patterns)" },
    { id: 86, name: "Fish Chopper", desc: "Chopper fish (jumps from water)" },
    { id: 39, name: "Kamere", desc: "Chameleon badnik (spits fireballs)" },
    { id: 57, name: "Kani", desc: "Crab badnik (walks and pinches)" },
    { id: 74, name: "Uni", desc: "Unibadnik (crawls on surfaces)" },
    { id: 51, name: "Buta", desc: "Pig badnik (charges forward)" },
    { id: 50, name: "Brobo", desc: "Robot badnik (shoots projectiles)" },
    { id: 49, name: "Imo", desc: "Caterpillar badnik (segmented)" },
    { id: 70, name: "Armadillo", desc: "Armadillo badnik (rolls and charges)" },
    { id: 71, name: "Yado", desc: "Hermit-crab badnik (retreats to shell)" },
    { id: 78, name: "Bat", desc: "Bat badnik (flies in swooping arcs)" },
    { id: 81, name: "Mogura", desc: "Mole badnik (pops from ground)" },
    { id: 25, name: "Pata", desc: "Flap enemy (hovers and drops)" },
    { id: 28, name: "Mawaru", desc: "Spinner badnik (rotates in place)" }
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
  function encodeBin(grid2) {
    const rows = grid2.length;
    const cols = grid2[0].length;
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
          pushU32(grid2[r][c]);
        }
      }
    }
    return out;
  }
  function encodeAct(objects2) {
    const entries = [];
    for (const obj of objects2) {
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
  function countObjectsInTile(objects2, tileCol, tileRow) {
    let count = 0;
    for (const obj of objects2) {
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

  // ts/main.ts
  var EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: #2a2a2a; overflow: hidden; user-select: none; }

/* \u2500\u2500 top bar \u2500\u2500 */
.topbar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
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
.canvas-wrap { flex: 1; position: relative; overflow: hidden; background: #d4e8c0; min-height: 0; }
canvas.display { position: absolute; top: 0; left: 0; cursor: crosshair; }
.scrollbar-row { display: flex; flex-shrink: 0; }
.scrollbar-row input[type=range] { flex: 1; height: 14px; }

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
  width: 64px; height: 64px; opacity: 0.7;
  border: 2px dashed #fff; background-size: cover; background-color: rgba(0,0,0,0.3);
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
      <div class="scrollbar-row">
        <input type="range" class="hscroll" min="0" max="1000" value="0" />
        <input type="range" class="vscroll" min="0" max="1000" value="0" />
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
  var grid = [];
  var objects = [];
  var activeTab = "tiles";
  var selectedTile = 1;
  var selectedObj = null;
  var zoom = 2;
  var scrollX = 0;
  var scrollY = 0;
  var panning = false;
  var panStartX = 0;
  var panStartY = 0;
  var panStartSX = 0;
  var panStartSY = 0;
  var painting = false;
  var erasing = false;
  var spaceHeld = false;
  var selectedObjIdx = -1;
  var dragObj = null;
  var dragOffX = 0;
  var dragOffY = 0;
  var hoverBx = -1;
  var hoverBy = -1;
  var paletteDrag = false;
  var paletteDragTile = 0;
  var canvasMouseX = -1;
  var canvasMouseY = -1;
  var mouseOverCanvas = false;
  var shadow;
  var canvas;
  var ctx;
  var spritesheetImg;
  var thumbstrip;
  var descEl;
  var statusEl;
  var counterEl;
  var canvasWrap;
  var ghostEl;
  function cellSize() {
    return Math.round(64 * zoom);
  }
  function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    grid = [];
    for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(0));
    objects = [];
    selectedObjIdx = -1;
  }
  function objectsInTile(tc, tr) {
    return countObjectsInTile(objects, tc, tr);
  }
  function totalObjects() {
    let c = 0;
    for (const o of objects) c += o.type <= 1 || o.type >= 63 && o.type <= 69 ? 1 + o.sub : 1;
    return c;
  }
  function updateCounter() {
    const sel = selectedObjIdx >= 0 ? objects[selectedObjIdx] : null;
    if (sel) {
      const n = objectsInTile(pixelToTile(sel.x), pixelToTile(sel.y));
      counterEl.textContent = `${n}/${MAX_OBJECTS_PER_TILE}`;
    } else {
      counterEl.textContent = `${totalObjects()}`;
    }
  }
  function setStatus(msg) {
    statusEl.textContent = msg;
  }
  function findDef(typeId) {
    for (const arr of [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES])
      for (const d of arr) if (d.id === typeId) return d;
    return null;
  }
  function draw() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, cs = cellSize();
    ctx.fillStyle = "#d4e8c0";
    ctx.fillRect(0, 0, W, H);
    const c0 = Math.max(0, Math.floor(scrollX / cs));
    const r0 = Math.max(0, Math.floor(scrollY / cs));
    const c1 = Math.min(grid[0].length, Math.ceil((scrollX + W) / cs) + 1);
    const r1 = Math.min(grid.length, Math.ceil((scrollY + H) / cs) + 1);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const id = grid[r][c];
        const dx = c * cs - scrollX, dy = r * cs - scrollY;
        if (id > 0 && id < TOTAL_BLOCKS && spritesheetImg.complete) {
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
      const y = Math.round(r * cs - scrollY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let c = c0; c <= c1; c++) {
      const x = Math.round(c * cs - scrollX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const dx = obj.x / BLOCK_PX * cs - scrollX;
      const dy = obj.y / BLOCK_PX * cs - scrollY;
      if (dx + cs < 0 || dx > W || dy + cs < 0 || dy > H) continue;
      const isSel = i === selectedObjIdx;
      const def = findDef(obj.type);
      ctx.fillStyle = isSel ? "rgba(255,80,80,0.7)" : "rgba(255,200,0,0.6)";
      ctx.fillRect(dx + 2, dy + 2, cs - 4, cs - 4);
      ctx.strokeStyle = isSel ? "#f00" : "#880";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 2, dy + 2, cs - 4, cs - 4);
      if (cs >= 24) {
        ctx.fillStyle = "#000";
        ctx.font = `${Math.max(8, Math.round(cs / 5))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def ? def.name.split(" ")[0] : `${obj.type}`, dx + cs / 2, dy + cs / 2);
      }
    }
  }
  function buildThumbnails() {
    thumbstrip.innerHTML = "";
    if (activeTab === "tiles") {
      for (let i = 0; i < USED_BLOCKS; i++) {
        const el = document.createElement("div");
        el.className = "thumb";
        el.title = `Block ${i}`;
        const cvs = document.createElement("canvas");
        cvs.width = BLOCK_PX;
        cvs.height = BLOCK_PX;
        const c = cvs.getContext("2d");
        if (spritesheetImg.complete) {
          const { x: sx, y: sy } = blockSheetXY(i);
          c.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, BLOCK_PX, BLOCK_PX);
        }
        el.appendChild(cvs);
        el.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          selectedTile = i;
          selectedObj = null;
          selectedObjIdx = -1;
          paletteDrag = true;
          paletteDragTile = i;
          updateDesc(`Block ${i} \u2014 drag onto grid to place`);
          draw();
        });
        thumbstrip.appendChild(el);
      }
    } else {
      const defs = activeTab === "objects" ? OBJECTS : activeTab === "rings" ? RING_TYPES : activeTab === "enemies" ? ENEMIES : ESSENTIALS;
      for (const def of defs) {
        const el = document.createElement("div");
        el.className = "thumb thumb-txt";
        el.title = def.desc;
        el.textContent = def.name;
        el.addEventListener("click", () => {
          selectedObj = def;
          selectedObjIdx = -1;
          updateDesc(`${def.name}: ${def.desc}`);
          draw();
        });
        thumbstrip.appendChild(el);
      }
    }
  }
  function updateDesc(text) {
    descEl.textContent = text;
  }
  function switchTab(tab) {
    activeTab = tab;
    selectedObj = null;
    selectedObjIdx = -1;
    shadow.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("tab-active", b.getAttribute("data-tab") === tab);
    });
    buildThumbnails();
    updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab \u2014 select an item below`);
    draw();
  }
  function canvasToWorld(e) {
    const rect = canvas.getBoundingClientRect();
    const cs = cellSize();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = mx + scrollX, wy = my + scrollY;
    return {
      bx: Math.floor(wx / cs),
      by: Math.floor(wy / cs),
      px: Math.floor(wx / cs * BLOCK_PX),
      py: Math.floor(wy / cs * BLOCK_PX)
    };
  }
  function inGrid(bx, by) {
    return bx >= 0 && bx < grid[0].length && by >= 0 && by < grid.length;
  }
  function onMouseDown(e) {
    var _a;
    e.preventDefault();
    const { bx, by, px, py } = canvasToWorld(e);
    if (spaceHeld || e.button === 1) {
      panning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartSX = scrollX;
      panStartSY = scrollY;
      canvas.style.cursor = "grabbing";
      return;
    }
    if (!inGrid(bx, by)) return;
    if (e.button === 2) {
      erasing = true;
      if (activeTab === "tiles") {
        grid[by][bx] = 0;
      } else {
        for (let i = objects.length - 1; i >= 0; i--) {
          const o = objects[i];
          if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
            objects.splice(i, 1);
            break;
          }
        }
      }
      updateCounter();
      draw();
      return;
    }
    if (selectedObj && activeTab !== "tiles") {
      if (objectsInTile(bx, by) >= MAX_OBJECTS_PER_TILE) {
        setStatus(`Max ${MAX_OBJECTS_PER_TILE} objects per tile!`);
        return;
      }
      objects.push({ x: snap8(px), y: snap8(py), variant: 0, type: selectedObj.id, sub: 0 });
      setStatus(`Placed ${selectedObj.name} at tile (${bx},${by})`);
      updateCounter();
      draw();
      return;
    }
    if (activeTab !== "tiles") {
      let found = -1;
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) {
          found = i;
          break;
        }
      }
      selectedObjIdx = found;
      if (found >= 0) {
        const o = objects[found];
        dragObj = o;
        dragOffX = px - o.x;
        dragOffY = py - o.y;
        setStatus(`Selected: ${((_a = findDef(o.type)) == null ? void 0 : _a.name) || o.type} at (${o.x},${o.y})`);
      } else {
        dragObj = null;
        setStatus("");
      }
      updateCounter();
      draw();
    }
  }
  function onMouseMove(e) {
    if (panning) {
      scrollX = panStartSX - (e.clientX - panStartX);
      scrollY = panStartSY - (e.clientY - panStartY);
      clampScroll();
      syncScrollbars();
      draw();
      return;
    }
    const { bx, by, px, py } = canvasToWorld(e);
    canvasMouseX = e.clientX;
    canvasMouseY = e.clientY;
    if (paletteDrag && inGrid(bx, by)) {
      hoverBx = bx;
      hoverBy = by;
      mouseOverCanvas = true;
    } else if (!paletteDrag) {
      hoverBx = -1;
      hoverBy = -1;
      mouseOverCanvas = false;
    }
    if (dragObj && selectedObjIdx >= 0) {
      dragObj.x = snap8(px - dragOffX);
      dragObj.y = snap8(py - dragOffY);
      updateCounter();
    }
    draw();
  }
  function onMouseUp(_e) {
    painting = false;
    erasing = false;
    panning = false;
    dragObj = null;
    canvas.style.cursor = spaceHeld ? "grab" : "crosshair";
    draw();
  }
  function onMouseLeave() {
    paletteDrag = false;
    painting = false;
    erasing = false;
    panning = false;
    dragObj = null;
    hoverBx = -1;
    hoverBy = -1;
    mouseOverCanvas = false;
    canvas.style.cursor = spaceHeld ? "grab" : "crosshair";
    draw();
  }
  function onContextMenu(e) {
    e.preventDefault();
  }
  function onKeyDown(e) {
    if (e.code === "Space" && !spaceHeld) {
      e.preventDefault();
      spaceHeld = true;
      canvas.style.cursor = "grab";
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedObjIdx >= 0) {
      objects.splice(selectedObjIdx, 1);
      selectedObjIdx = -1;
      setStatus("Deleted");
      updateCounter();
      draw();
    }
  }
  function onKeyUp(e) {
    if (e.code === "Space") {
      spaceHeld = false;
      canvas.style.cursor = "crosshair";
    }
  }
  function clampScroll() {
    scrollX = Math.max(0, Math.min(scrollX, grid[0].length * cellSize() - canvas.width));
    scrollY = Math.max(0, Math.min(scrollY, grid.length * cellSize() - canvas.height));
  }
  function syncScrollbars() {
    const h = shadow.querySelector(".hscroll");
    const v = shadow.querySelector(".vscroll");
    if (h) {
      h.max = String(Math.max(0, grid[0].length * cellSize() - canvas.width));
      h.value = String(scrollX);
    }
    if (v) {
      v.max = String(Math.max(0, grid.length * cellSize() - canvas.height));
      v.value = String(scrollY);
    }
  }
  function onWheel(e) {
    e.preventDefault();
    if (e.shiftKey) scrollX += e.deltaY;
    else scrollY += e.deltaY;
    clampScroll();
    syncScrollbars();
    draw();
  }
  function hasSonic() {
    return objects.some((o) => o.type === 151);
  }
  function hasGoal() {
    return objects.some((o) => o.type === 44);
  }
  async function doSave() {
    if (!hasSonic()) {
      setStatus("Error: Sonic Placer (spawn) is required!");
      return;
    }
    if (!hasGoal()) {
      setStatus("Error: Sign Post (goal) is required!");
      return;
    }
    setStatus("Saving...");
    try {
      const bin = encodeBin(grid), act = encodeAct(objects);
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
    const el = shadow.host;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }
  function doClearAll() {
    if (!confirm("Clear entire level? This cannot be undone.")) return;
    initGrid();
    selectedObjIdx = -1;
    setStatus("Level cleared");
    updateCounter();
    draw();
  }
  function resizeCanvas() {
    canvas.width = canvasWrap.clientWidth;
    canvas.height = canvasWrap.clientHeight;
    draw();
  }
  function setZoom(z) {
    zoom = z;
    shadow.querySelectorAll("[data-zoom]").forEach((b) => {
      b.classList.toggle("btn-active", parseFloat(b.getAttribute("data-zoom") || "0") === z);
    });
    resizeCanvas();
    syncScrollbars();
  }
  function updateGhost(e) {
    if (!paletteDrag) {
      ghostEl.classList.remove("visible");
      return;
    }
    ghostEl.classList.add("visible");
    ghostEl.style.left = e.clientX - 32 + "px";
    ghostEl.style.top = e.clientY - 32 + "px";
    if (activeTab === "tiles" && spritesheetImg.complete) {
      const { x: sx, y: sy } = blockSheetXY(paletteDragTile);
      ghostEl.style.backgroundImage = `url(${spritesheetImg.src})`;
      ghostEl.style.backgroundPosition = `-${sx}px -${sy}px`;
      ghostEl.style.backgroundSize = `${SHEET_SIZE}px ${SHEET_SIZE}px`;
    } else {
      ghostEl.style.backgroundImage = "none";
      ghostEl.style.backgroundColor = "rgba(255,200,0,0.5)";
    }
  }
  function onDocMouseMove(e) {
    updateGhost(e);
    if (!paletteDrag) return;
    const rect = canvas.getBoundingClientRect();
    const cs = cellSize();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = mx + scrollX, wy = my + scrollY;
    const bx = Math.floor(wx / cs), by = Math.floor(wy / cs);
    if (bx >= 0 && bx < grid[0].length && by >= 0 && by < grid.length) {
      hoverBx = bx;
      hoverBy = by;
      mouseOverCanvas = true;
    } else {
      hoverBx = -1;
      hoverBy = -1;
      mouseOverCanvas = false;
    }
    draw();
  }
  function onDocMouseUp(e) {
    ghostEl.classList.remove("visible");
    if (!paletteDrag) return;
    if (mouseOverCanvas && hoverBx >= 0 && hoverBy >= 0) {
      grid[hoverBy][hoverBx] = paletteDragTile;
      setStatus(`Placed block ${paletteDragTile} at (${hoverBx},${hoverBy})`);
      updateCounter();
    }
    paletteDrag = false;
    hoverBx = -1;
    hoverBy = -1;
    mouseOverCanvas = false;
    draw();
  }
  function boot() {
    var _a;
    const host = document.getElementById("gamecontainer");
    if (!host) return;
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = EDITOR_CSS;
    shadow.appendChild(style);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "height:100%;display:flex;flex-direction:column;";
    wrapper.innerHTML = EDITOR_HTML;
    shadow.appendChild(wrapper);
    canvas = shadow.querySelector("canvas.display");
    ctx = canvas.getContext("2d");
    canvasWrap = shadow.querySelector(".canvas-wrap");
    thumbstrip = shadow.querySelector(".thumbstrip");
    descEl = shadow.querySelector(".desc");
    statusEl = shadow.querySelector(".status");
    counterEl = shadow.querySelector(".counter");
    ghostEl = shadow.querySelector(".ghost");
    initGrid();
    spritesheetImg = new Image();
    spritesheetImg.onload = () => {
      buildThumbnails();
      draw();
    };
    spritesheetImg.src = "/editors/assets/spritesheet.png";
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
    const hBar = shadow.querySelector(".hscroll");
    const vBar = shadow.querySelector(".vscroll");
    hBar == null ? void 0 : hBar.addEventListener("input", () => {
      scrollX = parseInt(hBar.value, 10);
      draw();
    });
    vBar == null ? void 0 : vBar.addEventListener("input", () => {
      scrollY = parseInt(vBar.value, 10);
      draw();
    });
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
    window.addEventListener("resize", () => {
      resizeCanvas();
      syncScrollbars();
    });
    requestAnimationFrame(() => {
      resizeCanvas();
      syncScrollbars();
      updateCounter();
      switchTab("tiles");
    });
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
