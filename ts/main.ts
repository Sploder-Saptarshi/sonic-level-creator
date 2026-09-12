import {
  BLOCK_PX, DEFAULT_COLS, DEFAULT_ROWS, MAX_OBJECTS_PER_TILE, GRID_SNAP,
  ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES,
  SHEET_SIZE, SHEET_COLS, SHEET_BLOCK_SIZE, TOTAL_BLOCKS, USED_BLOCKS,
  blockSheetXY, encodeBin, encodeAct, toCSV, countObjectsInTile, snap8,
  pixelToTile, tileToPixel,
  PlacedObject, ObjectDef,
} from './format';

// ── Editor CSS (lives inside Shadow DOM, zero leakage) ──
const EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: #2a2a2a; overflow: hidden; user-select: none; }

/* ── top bar ── */
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

/* ── main split: canvas left, nothing right (canvas fills top 75%) ── */
.main { display: flex; flex: 1; min-height: 0; }

/* ── canvas area ── */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.canvas-wrap { flex: 1; position: relative; overflow: hidden; background: #d4e8c0; min-height: 0; }
canvas.display { position: absolute; top: 0; left: 0; cursor: crosshair; }
.scrollbar-row { display: flex; flex-shrink: 0; }
.scrollbar-row input[type=range] { flex: 1; height: 14px; }

/* ── bottom: tabs + options (25% height) ── */
.bottom { display: flex; height: 25%; min-height: 140px; border-top: 2px solid #555; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  border-right: 1px solid #555; background: #ddd; }
.tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid #999; }
.tab { padding: 4px 10px; border: 1px solid #999; border-bottom: none;
  background: #ccc; cursor: pointer; font-size: 11px; font-family: inherit; }
.tab:hover { background: #ddd; }
.tab-active { background: #fff; font-weight: bold; }
.thumbstrip { flex: 1; display: flex; gap: 3px; padding: 4px;
  overflow-x: auto; overflow-y: hidden; align-items: flex-start; }
.thumb { width: 36px; height: 36px; border: 1px solid #888; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
.thumb:hover { border-color: #f00; }
.thumb canvas { display: block; width: 32px; height: 32px; }
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

/* ── bottom bar ── */
.bottombar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
.bottombar-l { display: flex; gap: 6px; }
.btm-btn { padding: 3px 10px; border: 1px solid #666; background: #555; color: #fff;
  cursor: pointer; font-size: 11px; font-family: inherit; }
.btm-btn:hover { background: #777; }
`;

// ── Editor HTML template ──
const EDITOR_HTML = `
<div class="editor">
  <div class="topbar">
    <div class="topbar-l">
      <label>Zoom:</label>
      <button class="btn btn-active" data-zoom="1">100%</button>
      <button class="btn" data-zoom="0.5">50%</button>
      <button class="btn" data-zoom="0.25">25%</button>
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
</div>
`;

// ── State ──
let grid: number[][] = [];
let objects: PlacedObject[] = [];
let activeTab: 'tiles' | 'objects' | 'rings' | 'enemies' | 'essentials' = 'tiles';
let selectedTile = 1;
let selectedObj: ObjectDef | null = null;
let zoom = 1;
let scrollX = 0;
let scrollY = 0;
let panning = false;
let panStartX = 0;
let panStartY = 0;
let panStartSX = 0;
let panStartSY = 0;
let painting = false;
let erasing = false;
let spaceHeld = false;
let selectedObjIdx = -1;
let dragObj: PlacedObject | null = null;
let dragOffX = 0;
let dragOffY = 0;

// ── DOM (all inside shadow) ──
let shadow: ShadowRoot;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let spritesheetImg: HTMLImageElement;
let thumbstrip: HTMLElement;
let descEl: HTMLElement;
let statusEl: HTMLElement;
let counterEl: HTMLElement;
let canvasWrap: HTMLElement;

// ── Helpers ──
function cellSize(): number { return Math.round(64 * zoom); }
function initGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
  grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(0));
  objects = [];
  selectedObjIdx = -1;
}
function objectsInTile(tc: number, tr: number): number {
  return countObjectsInTile(objects, tc, tr);
}
function totalObjects(): number {
  let c = 0;
  for (const o of objects) c += (o.type <= 1 || (o.type >= 63 && o.type <= 69)) ? 1 + o.sub : 1;
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
function setStatus(msg: string) { statusEl.textContent = msg; }
function findDef(typeId: number): ObjectDef | null {
  for (const arr of [ESSENTIALS, RING_TYPES, OBJECTS, ENEMIES])
    for (const d of arr) if (d.id === typeId) return d;
  return null;
}

// ── Draw ──
function draw() {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height, cs = cellSize();

  ctx.fillStyle = '#d4e8c0';
  ctx.fillRect(0, 0, W, H);

  const c0 = Math.max(0, Math.floor(scrollX / cs));
  const r0 = Math.max(0, Math.floor(scrollY / cs));
  const c1 = Math.min(grid[0].length, Math.ceil((scrollX + W) / cs) + 1);
  const r1 = Math.min(grid.length, Math.ceil((scrollY + H) / cs) + 1);

  // blocks
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const id = grid[r][c];
      const dx = c * cs - scrollX, dy = r * cs - scrollY;
      if (id > 0 && id < TOTAL_BLOCKS && spritesheetImg.complete) {
        const { x: sx, y: sy } = blockSheetXY(id);
        try { ctx.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, dx, dy, cs, cs); }
        catch (_) { ctx.fillStyle = '#aabbcc'; ctx.fillRect(dx, dy, cs, cs); }
      } else if (id > 0) {
        ctx.fillStyle = '#aabbcc';
        ctx.fillRect(dx, dy, cs, cs);
      }
    }
  }

  // gridlines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let r = r0; r <= r1; r++) {
    const y = Math.round(r * cs - scrollY) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let c = c0; c <= c1; c++) {
    const x = Math.round(c * cs - scrollX) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // objects
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const dx = (obj.x / BLOCK_PX) * cs - scrollX;
    const dy = (obj.y / BLOCK_PX) * cs - scrollY;
    if (dx + cs < 0 || dx > W || dy + cs < 0 || dy > H) continue;
    const isSel = i === selectedObjIdx;
    const def = findDef(obj.type);
    ctx.fillStyle = isSel ? 'rgba(255,80,80,0.7)' : 'rgba(255,200,0,0.6)';
    ctx.fillRect(dx + 2, dy + 2, cs - 4, cs - 4);
    ctx.strokeStyle = isSel ? '#f00' : '#880';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 2, dy + 2, cs - 4, cs - 4);
    if (cs >= 24) {
      ctx.fillStyle = '#000';
      ctx.font = `${Math.max(8, Math.round(cs / 5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def ? def.name.split(' ')[0] : `${obj.type}`, dx + cs / 2, dy + cs / 2);
    }
  }
}

// ── Thumbnails ──
function buildThumbnails() {
  thumbstrip.innerHTML = '';
  if (activeTab === 'tiles') {
    for (let i = 0; i < USED_BLOCKS; i++) {
      const el = document.createElement('div');
      el.className = 'thumb';
      el.title = `Block ${i}`;
      const cvs = document.createElement('canvas');
      cvs.width = 32; cvs.height = 32;
      const c = cvs.getContext('2d')!;
      if (spritesheetImg.complete) {
        const { x: sx, y: sy } = blockSheetXY(i);
        c.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, 32, 32);
      }
      el.appendChild(cvs);
      el.addEventListener('click', () => {
        selectedTile = i; selectedObj = null; selectedObjIdx = -1;
        activeTab = 'tiles';
        updateDesc(`Block ${i} — click/drag to paint, right-click to erase`);
        draw();
      });
      thumbstrip.appendChild(el);
    }
  } else {
    const defs = activeTab === 'objects' ? OBJECTS :
                 activeTab === 'rings' ? RING_TYPES :
                 activeTab === 'enemies' ? ENEMIES : ESSENTIALS;
    for (const def of defs) {
      const el = document.createElement('div');
      el.className = 'thumb thumb-txt';
      el.title = def.desc;
      el.textContent = def.name;
      el.addEventListener('click', () => {
        selectedObj = def; selectedObjIdx = -1;
        updateDesc(`${def.name}: ${def.desc}`);
        draw();
      });
      thumbstrip.appendChild(el);
    }
  }
}
function updateDesc(text: string) { descEl.textContent = text; }

// ── Tab switch ──
function switchTab(tab: typeof activeTab) {
  activeTab = tab;
  selectedObj = null; selectedObjIdx = -1;
  shadow.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('tab-active', b.getAttribute('data-tab') === tab);
  });
  buildThumbnails();
  updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab — select an item below`);
  draw();
}

// ── Mouse → world coords ──
function canvasToWorld(e: MouseEvent): { bx: number; by: number; px: number; py: number } {
  const rect = canvas.getBoundingClientRect();
  const cs = cellSize();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = mx + scrollX, wy = my + scrollY;
  return {
    bx: Math.floor(wx / cs), by: Math.floor(wy / cs),
    px: Math.floor(wx / cs * BLOCK_PX), py: Math.floor(wy / cs * BLOCK_PX),
  };
}
function inGrid(bx: number, by: number) {
  return bx >= 0 && bx < grid[0].length && by >= 0 && by < grid.length;
}

// ── Canvas events ──
function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  const { bx, by, px, py } = canvasToWorld(e);

  if (spaceHeld || e.button === 1) {
    panning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panStartSX = scrollX; panStartSY = scrollY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (!inGrid(bx, by)) return;

  // right-click erase
  if (e.button === 2) {
    erasing = true;
    if (activeTab === 'tiles') {
      grid[by][bx] = 0;
    } else {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) { objects.splice(i, 1); break; }
      }
    }
    updateCounter(); draw(); return;
  }

  // object placement
  if (selectedObj && activeTab !== 'tiles') {
    if (objectsInTile(bx, by) >= MAX_OBJECTS_PER_TILE) {
      setStatus(`Max ${MAX_OBJECTS_PER_TILE} objects per tile!`); return;
    }
    objects.push({ x: snap8(px), y: snap8(py), variant: 0, type: selectedObj.id, sub: 0 });
    setStatus(`Placed ${selectedObj.name} at tile (${bx},${by})`);
    updateCounter(); draw(); return;
  }

  // tile paint
  if (activeTab === 'tiles') {
    painting = true;
    grid[by][bx] = selectedTile;
    updateCounter(); draw();
  } else {
    // select / drag object
    let found = -1;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (pixelToTile(o.x) === bx && pixelToTile(o.y) === by) { found = i; break; }
    }
    selectedObjIdx = found;
    if (found >= 0) {
      const o = objects[found];
      dragObj = o;
      dragOffX = px - o.x; dragOffY = py - o.y;
      setStatus(`Selected: ${findDef(o.type)?.name || o.type} at (${o.x},${o.y})`);
    } else {
      dragObj = null;
      setStatus('');
    }
    updateCounter(); draw();
  }
}

function onMouseMove(e: MouseEvent) {
  if (panning) {
    scrollX = panStartSX - (e.clientX - panStartX);
    scrollY = panStartSY - (e.clientY - panStartY);
    clampScroll(); syncScrollbars(); draw(); return;
  }

  const { bx, by, px, py } = canvasToWorld(e);

  if (dragObj && selectedObjIdx >= 0) {
    dragObj.x = snap8(px - dragOffX);
    dragObj.y = snap8(py - dragOffY);
    updateCounter(); draw(); return;
  }

  if ((painting || erasing) && inGrid(bx, by)) {
    if (activeTab === 'tiles') grid[by][bx] = erasing ? 0 : selectedTile;
    draw();
  }
}

function onMouseUp() {
  painting = false; erasing = false; panning = false; dragObj = null;
  canvas.style.cursor = spaceHeld ? 'grab' : 'crosshair';
}

function onContextMenu(e: MouseEvent) { e.preventDefault(); }

// ── Keyboard ──
function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !spaceHeld) {
    e.preventDefault(); spaceHeld = true; canvas.style.cursor = 'grab';
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjIdx >= 0) {
    objects.splice(selectedObjIdx, 1); selectedObjIdx = -1;
    setStatus('Deleted'); updateCounter(); draw();
  }
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') { spaceHeld = false; canvas.style.cursor = 'crosshair'; }
}

// ── Scroll ──
function clampScroll() {
  scrollX = Math.max(0, Math.min(scrollX, grid[0].length * cellSize() - canvas.width));
  scrollY = Math.max(0, Math.min(scrollY, grid.length * cellSize() - canvas.height));
}
function syncScrollbars() {
  const h = shadow.querySelector('.hscroll') as HTMLInputElement;
  const v = shadow.querySelector('.vscroll') as HTMLInputElement;
  if (h) { h.max = String(Math.max(0, grid[0].length * cellSize() - canvas.width)); h.value = String(scrollX); }
  if (v) { v.max = String(Math.max(0, grid.length * cellSize() - canvas.height)); v.value = String(scrollY); }
}
function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.shiftKey) scrollX += e.deltaY; else scrollY += e.deltaY;
  clampScroll(); syncScrollbars(); draw();
}

// ── Validation ──
function hasSonic() { return objects.some(o => o.type === 151); }
function hasGoal() { return objects.some(o => o.type === 44); }

// ── Actions ──
async function doSave() {
  if (!hasSonic()) { setStatus('Error: Sonic Placer (spawn) is required!'); return; }
  if (!hasGoal()) { setStatus('Error: Sign Post (goal) is required!'); return; }
  setStatus('Saving...');
  try {
    const bin = encodeBin(grid), act = encodeAct(objects);
    const resp = await fetch('/editors/save.php', {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
      body: toCSV(bin, act),
    });
    const r = await resp.json();
    setStatus(r.ok ? `Saved! (${r.binBytes}B BIN + ${r.actBytes}B ACT)` : `Save error: ${r.error}`);
  } catch (err: any) { setStatus(`Save failed: ${err.message}`); }
}
async function doTest() {
  if (!hasSonic() || !hasGoal()) { setStatus('Error: Sonic Placer + Sign Post required to test!'); return; }
  await doSave();
  window.open('/', '_blank');
}
function doFullscreen() {
  const el = shadow.host as HTMLElement;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen();
}
function doClearAll() {
  if (!confirm('Clear entire level? This cannot be undone.')) return;
  initGrid(); selectedObjIdx = -1; setStatus('Level cleared'); updateCounter(); draw();
}

// ── Resize ──
function resizeCanvas() {
  canvas.width = canvasWrap.clientWidth;
  canvas.height = canvasWrap.clientHeight;
  draw();
}

// ── Zoom ──
function setZoom(z: number) {
  zoom = z;
  shadow.querySelectorAll('[data-zoom]').forEach(b => {
    b.classList.toggle('btn-active', parseFloat(b.getAttribute('data-zoom') || '0') === z);
  });
  resizeCanvas();
  syncScrollbars();
}

// ── Boot ──
function boot() {
  const host = document.getElementById('gamecontainer');
  if (!host) return;

  shadow = host.attachShadow({ mode: 'open' });

  // inject style
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  shadow.appendChild(style);

  // inject HTML
  const wrapper = document.createElement('div');
  wrapper.innerHTML = EDITOR_HTML;
  shadow.appendChild(wrapper);

  // grab refs
  canvas = shadow.querySelector('canvas.display')!;
  ctx = canvas.getContext('2d')!;
  canvasWrap = shadow.querySelector('.canvas-wrap')!;
  thumbstrip = shadow.querySelector('.thumbstrip')!;
  descEl = shadow.querySelector('.desc')!;
  statusEl = shadow.querySelector('.status')!;
  counterEl = shadow.querySelector('.counter')!;

  initGrid();

  // load spritesheet
  spritesheetImg = new Image();
  spritesheetImg.onload = () => { buildThumbnails(); draw(); };
  spritesheetImg.src = '/editors/assets/spritesheet.png';

  // canvas events
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // keyboard
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // scrollbars
  const hBar = shadow.querySelector('.hscroll') as HTMLInputElement;
  const vBar = shadow.querySelector('.vscroll') as HTMLInputElement;
  hBar?.addEventListener('input', () => { scrollX = parseInt(hBar.value, 10); draw(); });
  vBar?.addEventListener('input', () => { scrollY = parseInt(vBar.value, 10); draw(); });

  // zoom buttons
  shadow.querySelectorAll('[data-zoom]').forEach(b => {
    b.addEventListener('click', () => setZoom(parseFloat(b.getAttribute('data-zoom') || '1')));
  });

  // tab buttons
  shadow.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab') as typeof activeTab));
  });

  // action buttons
  shadow.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', () => {
      const a = b.getAttribute('data-action');
      if (a === 'save') doSave();
      else if (a === 'test') doTest();
      else if (a === 'fullscreen') doFullscreen();
      else if (a === 'share') setStatus('SHARE — not wired yet');
      else if (a === 'mylevels') location.href = '/editors/?action=myLevels&gamegroupid=52';
      else if (a === 'alllevels') location.href = '/editors/?action=editorDetail&gamegroupid=52';
    });
  });

  // clear
  shadow.querySelector('.btn-clear')?.addEventListener('click', doClearAll);

  // resize
  window.addEventListener('resize', () => { resizeCanvas(); syncScrollbars(); });

  // first paint — defer to let shadow DOM layout compute
  requestAnimationFrame(() => {
    resizeCanvas();
    syncScrollbars();
    updateCounter();
    switchTab('tiles');
  });
}

document.addEventListener('DOMContentLoaded', boot);
