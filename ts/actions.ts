// ts/actions.ts — Save, test, fullscreen, clear, resize, zoom

import { encodeBin, encodeAct, toCSV } from './format';
import { S, cellSize, initGrid } from './state';
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

// Local-only save: downloads the level CSV. Never writes to the server.
export function doSave() {
  if (!levelValid()) return;
  const blob = new Blob([levelCSV()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'custom-level.csv';
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

// Session id flashvar the game expects (resolves to /<id>.swf API stub).
const TEST_API_ID = '9f3210793951251c83ea5addaa24b963';
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

async function swWorker(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('sw-timeout')), 5000)),
    ]) as ServiceWorkerRegistration | null;
    if (!reg) return null;
    return reg.active ?? navigator.serviceWorker.controller ?? null;
  } catch (_) {
    return null;
  }
}

function waitForControl(timeoutMs = 3000): Promise<void> {
  const swc = navigator.serviceWorker;
  if (!swc || swc.controller) return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(() => { swc.removeEventListener('controllerchange', onChange); resolve(); }, timeoutMs);
    swc.addEventListener('controllerchange', onChange, { once: true });
  });
}

// Stage the level in the worker and wait for its acknowledgement (with a
// timeout fallback so Test never hangs). The worker acks from memory
// immediately and persists in the background, so this resolves in
// milliseconds on a warm worker. The SWF caches the first getLevel
// answer for the whole movie load, so the CSV must be staged BEFORE the
// title screen is shown — staging after the switch races the title click
// and serves a stale level.
async function stageLevel(csv: string): Promise<boolean> {
  const sw = await swWorker();
  if (!sw) return false;
  try {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const t = setTimeout(done, 2000);
      try {
        const mc = new MessageChannel();
        mc.port1.onmessage = () => { clearTimeout(t); done(); };
        sw.postMessage({ type: 'stage-level', csv }, [mc.port2]);
      } catch (_) {
        clearTimeout(t);
        try { sw.postMessage({ type: 'stage-level', csv }); } catch (_) {}
        done();
      }
    });
    return true;
  } catch (_) {
    return false;
  }
}

// ── Background pre-staging ──
// Every grid/object mutation calls markDirty(). After a short idle window
// the current level is staged in the worker ahead of time, so the worker
// is warm (browsers stop idle workers) and its memory already holds the
// latest CSV when Test is pressed. doTest still does a final gated stage
// for correctness — but that resolves in milliseconds instead of waking a
// cold worker and waiting on disk I/O.
let preStageTimer: ReturnType<typeof setTimeout> | null = null;

export function markDirty() {
  if (preStageTimer) clearTimeout(preStageTimer);
  preStageTimer = setTimeout(() => {
    preStageTimer = null;
    // Mirror validity: never leave a stale *valid* level staged after the
    // user deletes Sonic/goal (Test itself is validity-gated anyway).
    if (levelValid()) stageLevel(levelCSV());
    else swWorker().then((sw) => { try { sw?.postMessage({ type: 'clear-level' }); } catch (_) {} });
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
  // gated stage below sends the fresh CSV (message order is FIFO, so memory
  // always ends on the latest).
  cancelPreStage();

  // The worker only intercepts gateway POSTs once it controls the page
  // (first visit: still installing/claiming). Wait for control first —
  // otherwise the getLevel request bypasses the worker and the server
  // answers with its stale stored blob.
  await waitForControl();
  // Stage before revealing: the title click leads to STAGESELECT getLevel,
  // which must already see this CSV. Nothing is sent to or written on the
  // server; the stock SWF's AMF call is answered locally from staged memory.
  const staged = await stageLevel(csv);
  if (!staged) {
    console.error('[editor] test Service Worker unavailable — test level may be stale');
  }

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
  // Clear the staged level (best-effort); the worker passes AMF through
  // to the network whenever nothing is staged.
  swWorker().then((sw) => { try { sw?.postMessage({ type: 'clear-level' }); } catch (_) {} });
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
  if (!S.canvas) return;
  S.canvas.width = S.grid[0].length * cellSize();
  S.canvas.height = S.grid.length * cellSize();
  draw();
}

export function setZoom(z: number) {
  S.zoom = z;
  S.shadow!.querySelectorAll('[data-zoom]').forEach(b => {
    b.classList.toggle('btn-active', parseFloat(b.getAttribute('data-zoom') || '0') === z);
  });
  resizeCanvas();
}
