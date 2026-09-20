// ts/main.ts — Boot: create Shadow DOM, initialise state, wire events

import { DEFAULT_COLS, DEFAULT_ROWS } from './format';
import { S, initGrid, cellSize, updateDesc } from './state';
import { EDITOR_CSS, EDITOR_HTML } from './ui';
import { draw, initGhostCanvas } from './render';
import { preloadSprites } from './sprites';
import { buildThumbnails, switchTab, updateCounter } from './thumbnails';
import { resizeCanvas, warmTestPlayer, loadLevelById } from './actions';
import { wireEvents } from './events';

// Timing diagnostics: ms since this bundle started executing (end of body,
// so a large value here means a parser-blocking script above stalled us).
const SCRIPT_T0 = performance.now();
console.log(`[editor:timing] bundle executed readyState=${document.readyState}`);

export function timingLog(tag: string) {
  console.log(`[editor:timing] ${tag} +${Math.round(performance.now() - SCRIPT_T0)}ms`);
}

function resourceMs(name: string): string {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const hit = entries.filter(e => e.name.endsWith(name)).pop();
  return hit ? ` (net ${Math.round(hit.responseEnd - hit.startTime)}ms)` : '';
}

// The level creator needs precise mouse input: on mobile devices the
// editor is blocked entirely and the start overlay instead tells the
// visitor to come back on desktop. Coarse pointers (phones, most
// tablets) always match; otherwise a small touch viewport counts.
function isMobileDevice(): boolean {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
  } catch (_) { /* matchMedia is best-effort */ }
  const touch = 'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints > 0);
  if (!touch) return false;
  const w = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return w > 0 && w < 700;
}

// Repurpose the create-level overlay as a desktop-only notice: swap the
// heading/text and drop the name field + start button so the editor can
// never be entered. The overlay stays up (no ?load= handling either).
function blockMobileEditor(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('.start-overlay');
  if (!overlay) return;
  const title = overlay.querySelector('.start-card h2');
  if (title) title.textContent = 'Desktop required';
  const msg = overlay.querySelector('.start-card p');
  if (msg) {
    msg.textContent =
      'The level creator needs a mouse and keyboard. ' +
      'Please visit on a desktop computer to build levels.';
  }
  overlay.querySelector('.start-row')?.remove();
  overlay.querySelector('.start-card label')?.remove();
  // Side-by-side layout: "Desktop required" on top, then message text
  // left and the Sonic render right.
  const card = overlay.querySelector('.start-card');
  const heading = overlay.querySelector('.start-card h2');
  const body = overlay.querySelector('.start-card p');
  if (card && heading && body) {
    card.classList.add('mobile-block');
    const wrap = document.createElement('div');
    wrap.className = 'mobile-text';
    card.insertBefore(wrap, body);
    wrap.appendChild(body);
  }
}

function boot() {
  timingLog(`boot DOMContentLoaded readyState=${document.readyState}`);
  console.log('[editor] build 20260913T1849 (object subtypes + thumb-blit canvas)');
  const host = document.getElementById('gamecontainer');
  if (!host) return;

  // No service worker anymore (test levels travel via the
  // __swfGetStagedLevel JS bridge). Unregister any leftover from older
  // builds so a stale worker can never shadow the gateway again.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration('/').then((r) => {
      try { r?.unregister(); } catch (_) { /* ignore */ }
    }).catch(() => {});
  }

  const shadow = host.attachShadow({ mode: 'open' });
  S.shadow = shadow;

  // Inject style
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  shadow.appendChild(style);

  // Inject HTML
  const wrapper = document.createElement('div');
  // position:relative anchors the absolute test-mode overlay (and its
  // invisible .warm pre-boot state) to the editor space.
  wrapper.style.cssText = 'height:100%;display:flex;flex-direction:column;position:relative;';
  wrapper.innerHTML = EDITOR_HTML;
  shadow.appendChild(wrapper);

  // Mobile gate: show the desktop notice instead of the editor and run
  // no further editor code (no canvas, events, sprite downloads, or
  // test-player warmup).
  if (isMobileDevice()) {
    blockMobileEditor(shadow);
    return;
  }

  // Grab DOM refs into state
  S.canvas = shadow.querySelector('canvas.display')!;
  S.ctx = S.canvas.getContext('2d')!;
  S.canvasWrap = shadow.querySelector('.canvas-wrap')!;
  S.thumbstrip = shadow.querySelector('.thumbstrip')!;
  S.descEl = shadow.querySelector('.desc')!;
  S.counterEl = shadow.querySelector('.counter')!;
  S.ghostEl = shadow.querySelector('#ghost')!;

  initGrid();
  initGhostCanvas();

  // Load spritesheet
  S.spritesheetImg = new Image();
  S.spritesheetImg.onload = () => {
    timingLog(`spritesheet onload${resourceMs('/editors/assets/spritesheet.png')}`);
    buildThumbnails();
    draw();
    // Tiles are painted — now the test-player warmup may use the pipe.
    warmOnce();
  };
  S.spritesheetImg.onerror = () => {
    timingLog('spritesheet onerror — warming test player anyway');
    warmOnce();
  };
  // Safety net: never let a stalled image block the warmup forever.
  setTimeout(warmOnce, 15000);
  timingLog('spritesheet fetch start');
  S.spritesheetImg.src = '/editors/assets/spritesheet.png';

  // Load hover glow overlay (drawn on top of the hovered filled tile)
  S.gloweyImg = new Image();
  S.gloweyImg.onload = () => { draw(); };
  S.gloweyImg.src = '/editors/assets/glowey.png';

  // Load object sprites (redraw thumbnails + canvas as each arrives)
  preloadSprites(() => { buildThumbnails(); draw(); });

  // Wire all event handlers
  wireEvents();

  // Open from My Levels (?load=<id>): fetch + decode straight into the
  // editor, skipping the start screens. The overlay is hidden
  // synchronously below so the create screen never flashes while the
  // fetch is in flight; a failed open reveals it again. Falls through to
  // a fresh level when the id is missing, foreign, or corrupt.
  const rawLoadId = new URLSearchParams(location.search).get('load');
  const loadId = rawLoadId && /^[\w-]{1,128}$/.test(rawLoadId) ? rawLoadId : null;
  if (loadId) {
    shadow.querySelector('.start-overlay')?.classList.add('hidden');
    loadLevelById(loadId).then((ok) => {
      if (ok) {
        timingLog('opened saved level');
        return;
      }
      shadow.querySelector('.start-overlay')?.classList.remove('hidden');
      const retryInput = shadow.querySelector('.start-name') as HTMLInputElement | null;
      retryInput?.focus();
      retryInput?.select();
    });
  }

  // Start screen is up: focus the name field, text selected, ready to type.
  // Skipped when opening a saved level (overlay hidden until a failure).
  if (!loadId) {
    const nameInput = shadow.querySelector('.start-name') as HTMLInputElement | null;
    nameInput?.focus();
    nameInput?.select();
  }

  // First paint — defer to let Shadow DOM layout compute
  requestAnimationFrame(() => {
    resizeCanvas();
    updateCounter();
    switchTab('tiles');
    timingLog('first paint (tiles tab)');
    // NOTE: test-player warmup is NOT started here. It downloads the full
    // game SWF + BGM, which starves the tile spritesheet on narrow servers
    // (php -S is single-threaded and serialises all local responses).
    // warmOnce() fires it after tiles paint (spritesheet onload), on image
    // error, or after a 15s safety timeout — whichever comes first.
  });
}

// Test-player warmup gate (see boot rAF note). Exactly-once.
let warmed = false;
function warmOnce() {
  if (warmed) return;
  warmed = true;
  timingLog('test-player warmup start');
  warmTestPlayer();
}

document.addEventListener('DOMContentLoaded', boot);
