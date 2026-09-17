// ts/main.ts — Boot: create Shadow DOM, initialise state, wire events

import { DEFAULT_COLS, DEFAULT_ROWS } from './format';
import { S, initGrid, cellSize, updateDesc } from './state';
import { EDITOR_CSS, EDITOR_HTML } from './ui';
import { draw, initGhostCanvas } from './render';
import { preloadSprites } from './sprites';
import { buildThumbnails, switchTab, updateCounter } from './thumbnails';
import { resizeCanvas, warmTestPlayer } from './actions';
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

  // Start screen is up: focus the name field, text selected, ready to type.
  const nameInput = shadow.querySelector('.start-name') as HTMLInputElement | null;
  nameInput?.focus();
  nameInput?.select();

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
