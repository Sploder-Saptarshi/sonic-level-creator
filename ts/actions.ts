// ts/actions.ts — Save, test, fullscreen, clear, resize, zoom

import { encodeBin, encodeAct, toCSV, decodeLevel, encodeCompact } from './format';
import { S, cellSize, initGrid, updateDesc } from './state';
import { draw } from './render';
import { updateCounter } from './thumbnails';

// ── Validation (game requires exactly one Sonic + one goal) ──

function levelValid(): boolean {
  const sonics = S.objects.filter(o => o.type === 151).length;
  const goals = S.objects.filter(o => o.type === 44).length;
  return sonics === 1 && goals === 1;
}

function levelCSV(): string {
  return toCSV(encodeBin(S.grid), encodeAct(S.objects));
}

// ── Actions ──

// "Start a new level" screen: take the chosen name (fall back to the
// default when blank) and move to the map-size step.
export function doStartCreating() {
  const input = S.shadow!.querySelector('.start-name') as HTMLInputElement | null;
  const name = (input?.value ?? '').trim();
  S.levelName = name || 'The Guide Zone';
  input?.blur();
  S.shadow!.querySelector('.start-card')?.setAttribute('hidden', '');
  S.shadow!.querySelector('.size-card')?.removeAttribute('hidden');
}

// Map-size step: apply the chosen dimensions and reveal the editor.
// Counts are grid cells (the original UI calls them "tiles").
export function doSelectMapSize(el: Element) {
  const cols = parseInt(el.getAttribute('data-cols') || '35', 10);
  const rows = parseInt(el.getAttribute('data-rows') || '8', 10);
  initGrid(cols, rows);
  S.selectedObjIdx = -1;
  updateCounter();
  S.shadow!.querySelector('.start-overlay')?.classList.add('hidden');
  resizeCanvas();
}

// Open from My Levels (?load=<id>): fetch the row, decode its CSV, and
// drop straight into the editor — no start screens. Returns true on success.
export async function loadLevelById(id: string): Promise<boolean> {
  if (!/^[\w-]{1,128}$/.test(id)) return false;
  let row: { name?: unknown; cols?: unknown; rows?: unknown; data?: unknown; published?: unknown };
  try {
    const res = await fetch(`/api/levels/${id}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { level?: typeof row };
    if (!body.level) return false;
    row = body.level;
  } catch {
    return false;
  }
  const parsed = typeof row.data === 'string' ? decodeLevel(row.data) : null;
  if (!parsed) return false;
  S.grid = parsed.grid;
  S.objects = parsed.objects;
  if (typeof row.name === 'string' && row.name.trim()) {
    S.levelName = row.name.trim();
  }
  S.levelId = id;
  // Already-published levels can never show Share again.
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

// Share: permanently publish the level so it appears in All Levels.
// Saves first when the level has never been saved; guests go to sign-in.
export async function doShare() {
  const boot = (window as unknown as { __PLAYSEGA__?: { username?: string } })
    .__PLAYSEGA__;
  if (!boot || boot.username === 'Guest' || !boot.username) {
    location.href = '/member/signin';
    return;
  }
  if (!levelValid()) return;
  if (!S.levelId) {
    await doSave();
    if (!S.levelId) return; // save failed (already fell back to download)
  }
  if (!confirm('Publishing is permanent. Share this level with everyone?')) return;
  try {
    const res = await fetch(`/api/levels/${S.levelId}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(`publish failed: ${res.status}`);
    updateDesc(`Published "${S.levelName}".`);
    hideShareButton();
  } catch {
    updateDesc('Publishing failed — try again.');
  }
}

// Save: signed-in users persist to the server (POST then PUT); guests and
// server failures fall back to a local CSV download so work is never lost.
export async function doSave() {
  if (!levelValid()) return;
  // Compact RLE-JSON for the server (10–27x smaller than CSV); the local
  // fallback stays CSV so it still opens in external tools.
  const compact = encodeCompact(S.grid, S.objects);
  const csv = levelCSV();
  const boot = (window as unknown as { __PLAYSEGA__?: { username?: string } })
    .__PLAYSEGA__;
  if (!boot || boot.username === 'Guest' || !boot.username) {
    downloadCSV(csv);
    return;
  }
  try {
    const payload = {
      name: S.levelName,
      cols: S.grid[0].length,
      rows: S.grid.length,
      data: compact,
    };
    const res = await fetch(
      S.levelId ? `/api/levels/${S.levelId}` : '/api/levels',
      {
        method: S.levelId ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    const saved = (await res.json()) as { id?: string };
    if (saved.id) S.levelId = saved.id;
    updateDesc(`Saved "${S.levelName}".`);
  } catch {
    updateDesc('Server save failed — downloaded a local copy instead.');
    downloadCSV(csv);
  }
}

// Local CSV download: guest fallback + server-failure safety net.
function downloadCSV(csv: string) {
  const blob = new Blob([csv], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // Filename from the level name; strip anything the filesystem dislikes.
  const slug = S.levelName.trim().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  a.download = (slug || 'custom-level') + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ── In-place test mode: one persistent universal-52.swf player ──
// Created once at editor boot and kept alive muted behind the editor, so
// opening Test skips the SWF fetch + Ruffle boot + audio load. The game
// parks at its title screen (no synthetic clicks) — the user clicks the
// title once, then STAGESELECT auto-loads ZONE_CUSTOM from the staged CSV.
// One universal 52.swf serves both the game page and the editor: with the
// "editortest" flashvar it holds the title BGM until the Test button
// releases it via the "editorStartAudio" ExternalInterface callback
// (title click is the fallback), so music starts from the top on every
// Test with the movie running unsuspended throughout. Without the flag
// (plain game page) it behaves exactly like stock.

// API connector flashvar the game expects (resolves to /<id>.swf).
// This is a static filename, not a session — real sessions live server-side.
const TEST_API_ID = 'api-connector';
const TEST_LEVEL_ID = '2914';

const TEST_LOAD_OPTS = {
  url: '/games/swf/52/52.swf',
  parameters: { id: TEST_API_ID, levelid: TEST_LEVEL_ID, editortest: '1' },
  // Aspect-preserving fill of the whole editor space, centered:
  // showAll scales the stage with aspect intact, letterbox "on" draws
  // the bars even when not fullscreen (page global is "off"), and
  // forceScale stops the game from switching its own Stage.scaleMode
  // (e.g. exactFit/noScale) and stretching. Per-movie options only —
  // the page global config is untouched.
  scale: 'showAll',
  letterbox: 'on',
  forceScale: true,
};

let testPlayer: any = null;
let testBooting: Promise<void> | null = null;
// True once the persistent player has a loaded title-screen movie. Guards
// doTest from calling load() again (Ruffle would destroy the warm instance
// and reload from scratch — the double-load + "Closed before resume"
// race in the console). Cleared on stop so the background reboot is forced.
let testReady = false;

// Release the held title BGM in the universal 52.swf (ExternalInterface
// callback registered by the SWF when the "editortest" flashvar is present).
// Ruffle exposes addCallback names as methods on the player element, so
// try the element first, then the versioned ruffle() API. Best-effort:
// if the call never lands, the title click releases the same audio.
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

// Create the persistent player element once (idempotent).
function ensureTestPlayer(): boolean {
  if (testPlayer) return true;
  const els = testEls();
  if (!els) return false;
  const RP = (window as any).RufflePlayer;
  if (!RP || !RP.newest) {
    console.error('[editor] Ruffle not loaded — cannot start test mode');
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

// Boot (or reboot) the movie in the background, muted. Shared promise so
// concurrent callers never double-load, plus a ready flag so Test never
// reloads an already-warm title screen. The movie runs unsuspended —
// the universal 52.swf holds its own title BGM until Test releases it,
// so the background stays silent without any audio plumbing.
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
    const els = testEls();
    if (els && els.mode.classList.contains('active')) {
      // User opened Test while this boot was in flight — doTest already
      // unmuted; release the held title audio now that the movie is ready.
      setTestVolume(1);
      callEditorStartAudio();
    } else {
      // Background state (warmup or Stop reload): silent. Movie runs on.
      setTestVolume(0);
    }
  })().catch((e) => {
    testReady = false;
    console.error('[editor] Ruffle load failed', e);
    throw e;
  }).finally(() => {
    testBooting = null;
  });
  // Swallow here for fire-and-forget callers (Stop reload); doTest
  // attaches its own outcome handling through the returned promise.
  testBooting.catch(() => {});
  return testBooting;
}

// Fire-and-forget warmup at editor boot: SWF fetch + Ruffle boot + audio
// load all happen while the user edits, muted and invisible.
export function warmTestPlayer() {
  // Add .warm BEFORE creating the player so the holder already has real
  // dimensions (opacity:0 keeps it invisible) — never boot into display:none.
  const pre = testEls();
  if (pre) pre.mode.classList.add('warm');
  if (!ensureTestPlayer()) {
    if (pre) pre.mode.classList.remove('warm');
    return;
  }
  bootTestMovie();
}

function testEls(): { editor: HTMLElement; mode: HTMLElement; holder: HTMLElement } | null {
  const sh = S.shadow;
  if (!sh) return null;
  const editor = sh.querySelector('.editor') as HTMLElement | null;
  const mode = sh.querySelector('.testmode') as HTMLElement | null;
  const holder = sh.querySelector('.ruffle-holder') as HTMLElement | null;
  if (!editor || !mode || !holder) return null;
  return { editor, mode, holder };
}

// ── Test-level bridge (no service worker) ──
// The patched 52.swf calls `__swfGetStagedLevel()` via ExternalInterface
// instead of the AMF gateway whenever it returns a non-empty CSV string.
// This works in browsers with service workers disabled (e.g. LibreWolf).
// The main game page (/index.html) defines no such function, so the SWF
// falls back to the gateway there — that flow is untouched.
let stagedCSV: string | null = null;

function publishStagedCSV(csv: string | null) {
  stagedCSV = csv;
  try {
    (window as any).__swfGetStagedLevel = () => stagedCSV;
  } catch (_) { /* ignore */ }
}

// Install at bundle load so the bridge exists before any movie boots.
publishStagedCSV(null);

// ── Background pre-staging ──
// Every grid/object mutation calls markDirty(). After a short idle window
// the current level is published to the JS bridge, so the string the SWF
// will read is already fresh when Test is pressed (doTest still publishes
// synchronously for correctness).
let preStageTimer: ReturnType<typeof setTimeout> | null = null;

export function markDirty() {
  if (preStageTimer) clearTimeout(preStageTimer);
  preStageTimer = setTimeout(() => {
    preStageTimer = null;
    // Mirror validity: never hand the movie a stale *valid* level after the
    // user deletes Sonic/goal (Test itself is validity-gated anyway).
    publishStagedCSV(levelValid() ? levelCSV() : null);
  }, 500);
}

function cancelPreStage() {
  if (preStageTimer) { clearTimeout(preStageTimer); preStageTimer = null; }
}

export async function doTest() {
  if (!levelValid()) return;
  const els = testEls();
  if (!els || els.mode.classList.contains('active')) return;
  if (!ensureTestPlayer()) return;

  // Capture synchronously — the editor hides below, so the grid can't
  // change mid-test anyway.
  const csv = levelCSV();
  // A debounced pre-stage may be pending with an older grid — drop it; the
  // publish below writes the fresh CSV (single writer, so the bridge always
  // ends on the latest).
  cancelPreStage();

  // Publish synchronously before revealing: the title click leads to
  // STAGESELECT getLevel, which reads this string via ExternalInterface.
  // No network, no worker, no race — the value is already in page memory.
  // Nothing is sent to or written on the server.
  publishStagedCSV(csv);

  // Switch: unmute + release the held title BGM (a click gesture, so
  // autoplay policy allows it) — the movie itself never stopped.
  els.editor.classList.add('hidden');
  els.mode.classList.remove('warm');
  els.mode.classList.add('active');
  setTestVolume(1);
  callEditorStartAudio();
  // If the background boot hasn't finished (or a Stop reload is in flight),
  // the title simply appears when ready — no second load is started.
  // If nothing was ever booted (Ruffle arrived after editor boot), boot now.
  bootTestMovie().catch(() => {
    stopTest();
  });
}

export function stopTest() {
  const els = testEls();
  if (!els) return;
  if (els) {
    els.mode.classList.remove('active');
    els.editor.classList.remove('hidden');
  }
  // Clear the staged level so a stray getLevel falls back to the gateway
  // (saved default level) instead of a stale custom level.
  publishStagedCSV(null);
  if (testPlayer) {
    // Back muted and reboot to the title screen so the next Test opens
    // warm with held audio from the top. The player element itself is
    // never destroyed. Invalidate first: the played movie is dirty, so
    // this reboot is forced (doTest's path is guarded and never reloads
    // a ready title).
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
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen();
}

export function doClearAll() {
  if (!confirm('Clear entire level? This cannot be undone.')) return;
  initGrid();
  S.selectedObjIdx = -1;
  updateCounter();
  markDirty();
  draw();
}

// ── Resize / Zoom ──

export function resizeCanvas() {
  if (!S.canvas || !S.canvasWrap || !S.grid.length) return;
  // Viewport-sized backing store: a full-grid canvas (16384x3072, ~192 MiB
  // at 100%) falls off GPU acceleration and every paint goes through the
  // CPU compositor. The grid-sized .canvas-inner keeps the scroll range;
  // the sticky canvas only ever holds the visible viewport (see draw()).
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
