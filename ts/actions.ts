// Editor actions: start screens, load/save/share, test mode, fullscreen,
// clear, resize and zoom.

import { encodeBin, encodeAct, toCSV, decodeLevel, encodeCompact } from './format';
import { S, cellSize, initGrid, updateDesc } from './state';
import { draw } from './render';
import { updateCounter } from './thumbnails';

const SONIC_TYPE = 151;
const GOAL_TYPE = 44;

// ── Validation: the game needs exactly one Sonic and one goal ──

function countEssentials(): { sonics: number; goals: number } {
  return {
    sonics: S.objects.filter(o => o.type === SONIC_TYPE).length,
    goals: S.objects.filter(o => o.type === GOAL_TYPE).length,
  };
}

function levelValid(): boolean {
  const { sonics, goals } = countEssentials();
  return sonics === 1 && goals === 1;
}

function levelProblems(): string[] {
  const { sonics, goals } = countEssentials();
  const out: string[] = [];
  if (sonics === 0 && goals === 0) {
    out.push('Your level has no start and no finish. Open the Essentials tab and place Sonic and a Sign Post.');
  } else {
    if (sonics === 0) out.push('Your level has no start. Open the Essentials tab and place Sonic.');
    if (goals === 0) out.push('Your level has no finish. Open the Essentials tab and place a Sign Post.');
  }
  if (sonics > 1) out.push('Your level has more than one Sonic. Keep just one Sonic so the game knows where to start.');
  if (goals > 1) out.push('Your level has more than one Sign Post. Keep just one so the game knows where the level ends.');
  return out;
}

// Returns false (after showing why) when the level can't be saved or tested.
function ensureValid(showError: (msg: string) => void): boolean {
  if (levelValid()) return true;
  const why = levelProblems().join(' ');
  updateDesc(why);
  showError(why);
  return false;
}

function levelCSV(): string {
  return toCSV(encodeBin(S.grid), encodeAct(S.objects));
}

function isSignedIn(): boolean {
  const boot = (window as unknown as { __PLAYSEGA__?: { username?: string } }).__PLAYSEGA__;
  return !!boot?.username && boot.username !== 'Guest';
}

// ── Start screens and loading ──

// The heading lives in the light DOM, outside the shadow root.
export function updateCreatorHeading() {
  const el = document.querySelector('#box3 h3 .fancy');
  if (el) {
    el.textContent = S.levelName
      ? `Sonic The Hedgehog Level Creator - ${S.levelName}`
      : 'Sonic The Hedgehog Level Creator';
  }
}

export function doStartCreating() {
  const input = S.shadow!.querySelector('.start-name') as HTMLInputElement | null;
  S.levelName = (input?.value ?? '').trim();
  if (!S.levelName) return;
  updateCreatorHeading();
  input?.blur();
  S.shadow!.querySelector('.start-card')?.setAttribute('hidden', '');
  S.shadow!.querySelector('.size-card')?.removeAttribute('hidden');
}

export function doSelectMapSize(el: Element) {
  const cols = parseInt(el.getAttribute('data-cols') || '35', 10);
  const rows = parseInt(el.getAttribute('data-rows') || '8', 10);
  initGrid(cols, rows);
  S.selectedObjIdx = -1;
  updateCounter();
  S.shadow!.querySelector('.start-overlay')?.classList.add('hidden');
  resizeCanvas();
}

interface LevelRow {
  name?: unknown;
  data?: unknown;
  published?: unknown;
}

async function fetchLevel(id: string): Promise<LevelRow | null> {
  try {
    const res = await fetch(`/api/levels/${id}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { level?: LevelRow };
    return body.level ?? null;
  } catch {
    return null;
  }
}

// Opens a saved level straight into the editor, skipping the start screens.
export async function loadLevelById(id: string): Promise<boolean> {
  if (!/^[\w-]{1,128}$/.test(id)) return false;
  const row = await fetchLevel(id);
  const parsed = row && typeof row.data === 'string' ? decodeLevel(row.data) : null;
  if (!row || !parsed) return false;
  S.grid = parsed.grid;
  S.objects = parsed.objects;
  if (typeof row.name === 'string' && row.name.trim()) S.levelName = row.name.trim();
  updateCreatorHeading();
  S.levelId = id;
  if (row.published) hideShareButton();
  S.selectedObjIdx = -1;
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
  updateCounter();
  markDirty();
  S.shadow!.querySelector('.start-overlay')?.classList.add('hidden');
  resizeCanvas();
  return true;
}

function hideShareButton() {
  const btn = S.shadow!.querySelector('[data-action="share"]') as HTMLElement | null;
  if (btn) btn.style.display = 'none';
}

// ── Popups (the save overlay doubles as the generic message box) ──

function showPopup(title: string, msg: string, showOk: boolean) {
  const sh = S.shadow;
  if (!sh) return;
  const ov = sh.querySelector('.save-overlay');
  const titleEl = sh.querySelector('.save-overlay .save-title');
  const msgEl = sh.querySelector('.save-overlay .save-msg');
  const ok = sh.querySelector('.save-overlay .save-ok');
  if (!ov || !titleEl || !msgEl || !ok) return;
  titleEl.textContent = title;
  msgEl.textContent = msg;
  ok.classList.toggle('hidden', !showOk);
  ov.classList.remove('hidden');
}

export function showSaveSaving() {
  showPopup('Saving...', 'Please wait while your level is saved.', false);
}

export function showSaveComplete(msg: string) {
  showPopup('Save complete', msg, true);
}

export function showSaveError(msg: string) {
  showPopup('Cannot save', msg, true);
}

export function showTestError(msg: string) {
  showPopup('Cannot test', msg, true);
}

export function showPlaceError(msg: string) {
  showPopup('Cannot place object', msg, true);
}

export function showDeleteError(msg: string) {
  showPopup('Cannot delete tile', msg, true);
}

export function hideSaveOverlay() {
  S.shadow?.querySelector('.save-overlay')?.classList.add('hidden');
}

// ── Save and share ──

// Publishing is permanent, so it asks first, then saves so the published
// copy matches the current edits. Guests are sent to sign-in.
export async function doShare() {
  if (!isSignedIn()) {
    location.href = '/member/signin';
    return;
  }
  if (!ensureValid(showSaveError)) return;
  if (!confirm('Publishing is permanent. Share this level with everyone?')) return;
  const saved = await doSave({ publishFlow: true });
  if (!saved || !S.levelId) return;
  showPopup('Publishing...', 'Please wait while your level is published.', false);
  try {
    const res = await fetch(`/api/levels/${S.levelId}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(`publish failed: ${res.status}`);
    updateDesc(`Published "${S.levelName}".`);
    showPopup('Publish complete', `"${S.levelName}" was published. It now appears in All Levels.`, true);
    hideShareButton();
  } catch {
    updateDesc('Publishing failed - try again.');
    showPopup('Share failed', 'Publishing failed - check your connection and try again.', true);
  }
}

// POST creates the level, PUT updates it. Returns false when the server
// rejects the save.
async function saveToServer(): Promise<boolean> {
  const payload = {
    name: S.levelName,
    cols: S.grid[0].length,
    rows: S.grid.length,
    data: encodeCompact(S.grid, S.objects),
  };
  try {
    const res = await fetch(S.levelId ? `/api/levels/${S.levelId}` : '/api/levels', {
      method: S.levelId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const saved = (await res.json()) as { id?: string };
    if (saved.id) S.levelId = saved.id;
    return true;
  } catch {
    return false;
  }
}

// Puts ?load=<id> in the URL so a refresh reopens this level.
function pinLoadParam() {
  if (!S.levelId) return;
  const url = new URL(location.href);
  if (url.searchParams.get('load') === S.levelId) return;
  url.searchParams.set('load', S.levelId);
  history.replaceState(null, '', url);
}

// Signed-in users save to the server; guests download a CSV. With
// publishFlow (Share), success stays silent so the caller shows its own popup.
export async function doSave(opts?: { publishFlow?: boolean }): Promise<boolean> {
  if (!ensureValid(showSaveError)) return false;
  // The start screen requires a name, so this is only a guard.
  if (!S.levelName) {
    updateDesc('Name your level on the start screen first.');
    showSaveComplete('Name your level on the start screen first.');
    return false;
  }
  const csv = levelCSV();
  showSaveSaving();
  // Let the overlay paint before the download or request.
  await new Promise((r) => setTimeout(r, 30));
  if (!isSignedIn()) {
    downloadCSV(csv);
    updateDesc(`Saved "${S.levelName}".`);
    showSaveComplete(`"${S.levelName}" was saved.`);
    return true;
  }
  if (!(await saveToServer())) {
    updateDesc('Server save failed - try again.');
    showPopup('Save failed', 'The server did not save your level - check your connection and try again.', true);
    return false;
  }
  pinLoadParam();
  updateDesc(`Saved "${S.levelName}".`);
  if (!opts?.publishFlow) showSaveComplete(`"${S.levelName}" was saved.`);
  return true;
}

function downloadCSV(csv: string) {
  const blob = new Blob([csv], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = S.levelName.trim().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  a.download = (slug || 'custom-level') + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ── Test mode ──
// One Ruffle player is created at boot and kept muted behind the editor so
// Test opens instantly. With the "editortest" flashvar, 52.swf holds its
// title music until editorStartAudio() releases it. The user clicks the
// title, and the game then reads the level from __swfGetStagedLevel().

// The api-connector id is a static SWF filename, not a session.
const TEST_LOAD_OPTS = {
  url: '/games/swf/52/52.swf',
  parameters: { id: 'api-connector', levelid: '2914', editortest: '1' },
  // Ruffle renders only the 640x448 SWF; fitTestRuffle() scales it to fill
  // the holder.
  backgroundColor: "#000000",
  scale: 'noscale',
  letterbox: 'off',
  forceScale: true,
};

let testPlayer: any = null;
let testBooting: Promise<void> | null = null;
// Set once the title screen is loaded, so Test never reloads a warm player.
let testReady = false;

// Ruffle exposes SWF callbacks on the element and on the versioned API.
// If this never lands, clicking the title releases the music instead.
function callEditorStartAudio() {
  if (!testPlayer) return;
  try {
    if (typeof testPlayer.editorStartAudio === 'function') testPlayer.editorStartAudio();
  } catch (_) { /* ignore */ }
  try {
    const api = testPlayer.ruffle ? testPlayer.ruffle() : null;
    if (api && typeof api.editorStartAudio === 'function') api.editorStartAudio();
  } catch (_) { /* ignore */ }
}

function setTestVolume(v: number) {
  if (!testPlayer) return;
  try {
    const api = testPlayer.ruffle ? testPlayer.ruffle() : testPlayer;
    if (api && typeof api.volume === 'number') api.volume = v;
  } catch (_) { /* ignore */ }
  try {
    if (typeof testPlayer.volume === 'number') testPlayer.volume = v;
  } catch (_) { /* ignore */ }
}

function testEls(): { mode: HTMLElement; holder: HTMLElement } | null {
  const sh = S.shadow;
  if (!sh) return null;
  const mode = sh.querySelector('.testmode') as HTMLElement | null;
  const holder = sh.querySelector('.ruffle-holder') as HTMLElement | null;
  if (!mode || !holder) return null;
  return { mode, holder };
}

function ensureTestPlayer(): boolean {
  if (testPlayer) return true;
  const els = testEls();
  if (!els) return false;
  const RP = (window as any).RufflePlayer;
  if (!RP || !RP.newest) {
    console.error('[editor] Ruffle not loaded, cannot start test mode');
    return false;
  }
  try {
    testPlayer = RP.newest().createPlayer();
  } catch (e) {
    console.error('[editor] Ruffle createPlayer failed', e);
    testPlayer = null;
    return false;
  }
  setTestVolume(0);
  els.holder.appendChild(testPlayer);
  setTestVolume(0);
  return true;
}

// Loads the movie muted in the background. Concurrent callers share one
// load; `force` reloads after a test run.
function bootTestMovie(force = false): Promise<void> {
  if (testReady && !force) return Promise.resolve();
  if (testBooting) return testBooting;
  const player = testPlayer;
  if (!player) return Promise.resolve();
  if (force) testReady = false;
  testBooting = (async () => {
    const api = player.ruffle ? player.ruffle() : player;
    await api.load({ ...TEST_LOAD_OPTS });
    testReady = true;
    // Test may have opened while this was loading.
    const testing = testEls()?.mode.classList.contains('active');
    setTestVolume(testing ? 1 : 0);
    if (testing) callEditorStartAudio();
  })().catch((e) => {
    testReady = false;
    console.error('[editor] Ruffle load failed', e);
    throw e;
  }).finally(() => {
    testBooting = null;
  });
  // Fire-and-forget callers ignore failures; doTest handles them itself.
  testBooting.catch(() => {});
  return testBooting;
}

// .warm gives the holder real (invisible) dimensions before Ruffle boots
// into it; it can't boot into display:none.
export function warmTestPlayer() {
  const pre = testEls();
  if (pre) pre.mode.classList.add('warm');
  if (!ensureTestPlayer()) {
    if (pre) pre.mode.classList.remove('warm');
    return;
  }
  bootTestMovie();
}

// The patched 52.swf reads test levels from this ExternalInterface bridge
// (no service worker). The game page doesn't define it, so the SWF falls
// back to the gateway there.
let stagedCSV: string | null = null;

function publishStagedCSV(csv: string | null) {
  stagedCSV = csv;
  try {
    (window as any).__swfGetStagedLevel = () => stagedCSV;
  } catch (_) { /* ignore */ }
}

publishStagedCSV(null);

// Every edit calls markDirty(); after a short idle the current level is
// staged so it's already fresh when Test is pressed. Invalid levels stage
// null so the movie never sees a stale valid one.
let preStageTimer: ReturnType<typeof setTimeout> | null = null;

export function markDirty() {
  if (preStageTimer) clearTimeout(preStageTimer);
  preStageTimer = setTimeout(() => {
    preStageTimer = null;
    publishStagedCSV(levelValid() ? levelCSV() : null);
  }, 500);
}

function cancelPreStage() {
  if (preStageTimer) { clearTimeout(preStageTimer); preStageTimer = null; }
}

function failTest(msg: string) {
  updateDesc(msg);
  showTestError(msg);
}

// Unmutes and releases the held title music; the Test click counts as the
// user gesture that autoplay policies require.
function revealTestMode(mode: HTMLElement) {
  mode.classList.remove('warm');
  mode.classList.add('active');
  setTestVolume(1);
  callEditorStartAudio();
  // Reapply the last scale to avoid a 640x448 flash before layout.
  if (cachedTestScale) {
    const pre = S.shadow?.querySelector(
      ".ruffle-holder ruffle-player, .ruffle-holder ruffle-object",
    ) as HTMLElement | null;
    if (pre) pre.style.transform = `scale(${cachedTestScale})`;
  }
  scheduleFit();
}

export async function doTest() {
  if (!ensureValid(showTestError)) return;
  const els = testEls();
  if (!els || els.mode.classList.contains('active')) return;
  if (!ensureTestPlayer()) {
    failTest('The test player could not load. Check your connection and reload the page, then try again.');
    return;
  }
  // Stage synchronously; a pending pre-stage may hold an older grid.
  cancelPreStage();
  publishStagedCSV(levelCSV());
  revealTestMode(els.mode);
  // A no-op when the background load already finished.
  bootTestMovie().catch(() => {
    stopTest();
    failTest('The test player failed to start. Reload the page and try again.');
  });
}

export function stopTest() {
  const els = testEls();
  if (!els) return;
  els.mode.classList.remove('active');
  // A stray getLevel now falls back to the gateway, not a stale level.
  publishStagedCSV(null);
  fitTestRuffle();
  if (testPlayer) {
    // Reload the title screen muted so the next Test opens warm.
    els.mode.classList.add('warm');
    setTestVolume(0);
    bootTestMovie(true);
  } else {
    els.mode.classList.remove('warm');
  }
  resizeCanvas();
  draw();
}

export function doFullscreen() {
  const el = S.shadow!.host as HTMLElement;
  if (document.fullscreenElement) {
    document.exitFullscreen();
    scheduleFit();
    return;
  }
  // A denied request isn't actionable; the next click simply retries.
  try {
    const r = el.requestFullscreen();
    if (r && typeof r.catch === "function") r.catch(() => {});
    scheduleFit();
  } catch {
    /* fullscreen unsupported: ignore */
  }
}

// Scales the fixed 640x448 player to fill the holder (windowed) or the
// viewport (fullscreen). The last scale is cached to avoid a first-frame
// flash before the holder is laid out.
let cachedTestScale: number | null = null;

function isHostFullscreen(): boolean {
  const host = S.shadow?.host as HTMLElement | null;
  return !!host && (document.fullscreenElement === host || (document as any).webkitFullscreenElement === host);
}

function fitTestRuffle() {
  const holder = S.shadow?.querySelector(".ruffle-holder") as HTMLElement | null;
  const player = S.shadow?.querySelector(
    ".ruffle-holder ruffle-player, .ruffle-holder ruffle-object",
  ) as HTMLElement | null;
  const mode = S.shadow?.querySelector(".testmode") as HTMLElement | null;
  if (!player || !holder || !mode?.classList.contains("active")) {
    if (player) player.style.transform = "";
    return;
  }
  const isFull = isHostFullscreen();
  const containerW = isFull ? window.innerWidth : holder.clientWidth;
  const containerH = isFull ? window.innerHeight : holder.clientHeight;
  if (!containerW || !containerH) {
    if (cachedTestScale) player.style.transform = `scale(${cachedTestScale})`;
    return;
  }
  const scale = Math.min(containerW / 640, containerH / 448);
  const s = isFinite(scale) && scale > 0 ? scale : 1;
  cachedTestScale = s;
  player.style.transform = `scale(${s})`;
}

// Two frames cover the first layout and the next paint.
function scheduleFit() {
  requestAnimationFrame(() => {
    fitTestRuffle();
    requestAnimationFrame(fitTestRuffle);
  });
  setTimeout(fitTestRuffle, 30);
}

// Refits on viewport changes, and on holder resizes once the shadow root
// exists.
function observeHolderResize() {
  const obs = new ResizeObserver(() => fitTestRuffle());
  const startObs = () => {
    const holder = S.shadow?.querySelector(".ruffle-holder") as HTMLElement | null;
    if (holder) obs.observe(holder);
    else setTimeout(startObs, 200);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObs);
  } else {
    setTimeout(startObs, 200);
  }
}

(function initTestFullscreen() {
  const evts = ["fullscreenchange", "webkitfullscreenchange", "resize", "orientationchange"];
  for (const e of evts) {
    document.addEventListener(e, fitTestRuffle as any);
    window.addEventListener(e, fitTestRuffle as any);
  }
  try {
    window.visualViewport?.addEventListener("resize", fitTestRuffle as any);
  } catch {}
  try {
    observeHolderResize();
  } catch {}
})();

export function doClearAll() {
  if (!confirm('Clear entire level? This cannot be undone.')) return;
  initGrid();
  S.selectedObjIdx = -1;
  updateCounter();
  markDirty();
  draw();
}

// ── Resize and zoom ──

// The canvas backing store only covers the viewport (a full-grid canvas
// would fall off GPU acceleration); .canvas-inner keeps the scroll range.
export function resizeCanvas() {
  if (!S.canvas || !S.canvasWrap || !S.grid.length) return;
  const viewW = S.canvasWrap.clientWidth, viewH = S.canvasWrap.clientHeight;
  if (viewW > 0 && viewH > 0) {
    S.canvas.width = viewW;
    S.canvas.height = viewH;
    const inner = S.shadow!.querySelector('.canvas-inner') as HTMLElement | null;
    if (inner) {
      inner.style.width = S.grid[0].length * cellSize() + 'px';
      inner.style.height = S.grid.length * cellSize() + 'px';
    }
  }
  draw();
}

export function setZoom(z: number) {
  S.zoom = z;
  S.shadow!.querySelectorAll('[data-zoom]').forEach(b => {
    b.classList.toggle('btn-active', parseFloat(b.getAttribute('data-zoom') || '0') === z);
  });
  resizeCanvas();
}
