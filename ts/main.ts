// Editor boot: mount the Shadow DOM UI, load assets and wire events.

import { S, initGrid } from './state';
import EDITOR_CSS from './ui/editor.css' with { type: 'text' };
import EDITOR_HTML from './ui/editor.html' with { type: 'text' };
import { draw, initGhostCanvas } from './render';
import { preloadSprites } from './sprites';
import { buildThumbnails, switchTab, updateCounter } from './thumbnails';
import { resizeCanvas, warmTestPlayer, loadLevelById } from './actions';
import { wireEvents } from './events';

const SPRITESHEET_URL = '/editors/assets/spritesheet.png';
const WARMUP_TIMEOUT_MS = 15000;

// Ms since the bundle started executing (it loads at the end of <body>).
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

// The editor needs a mouse: coarse pointers always count as mobile, and so
// does any small touch viewport.
function isMobileDevice(): boolean {
  if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const w = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return w > 0 && w < 700;
}

function allLevelsButton(): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'mobile-actions';
  const button = document.createElement('button');
  button.className = 'btm-btn';
  button.setAttribute('type', 'button');
  const label = document.createElement('span');
  label.textContent = 'All Levels';
  button.appendChild(label);
  button.addEventListener('click', () => {
    location.href = '/editors/alllevels';
  });
  actions.appendChild(button);
  return actions;
}

// Turns the start overlay into a permanent "Desktop required" notice: text
// on the left, Sonic art on the right, and an All Levels button.
function blockMobileEditor(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('.start-overlay');
  if (!overlay) return;
  const card = overlay.querySelector('.start-card');
  const heading = overlay.querySelector('.start-card h2');
  const body = overlay.querySelector('.start-card p');
  const art = overlay.querySelector('.start-sonic') as HTMLImageElement | null;
  if (heading) heading.textContent = 'Desktop required';
  if (body) {
    body.textContent =
      'The level creator needs a mouse and keyboard. ' +
      'Please visit on a desktop computer to build levels.';
  }
  overlay.querySelector('.start-row')?.remove();
  overlay.querySelector('.start-card label')?.remove();
  if (!card || !heading || !body) return;
  card.classList.add('mobile-block');
  if (art) {
    art.src = '/images/sonictoolbox.webp';
    art.width = 552;
    art.height = 512;
    art.alt = 'Sonic with a toolbox';
  }
  const text = document.createElement('div');
  text.className = 'mobile-text';
  card.insertBefore(text, body);
  text.appendChild(body);
  card.appendChild(allLevelsButton());
}

// Test levels now travel through a JS bridge; drop any service worker left
// by older builds so it can never shadow the gateway.
function unregisterLegacyServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration('/').then((r) => {
    try { r?.unregister(); } catch (_) { /* ignore */ }
  }).catch(() => {});
}

function mountShadow(host: HTMLElement): ShadowRoot {
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  shadow.appendChild(style);
  const wrapper = document.createElement('div');
  // position:relative anchors the absolute test-mode overlay.
  wrapper.style.cssText = 'height:100%;display:flex;flex-direction:column;position:relative;';
  wrapper.innerHTML = EDITOR_HTML;
  shadow.appendChild(wrapper);
  return shadow;
}

function bindDomRefs(shadow: ShadowRoot) {
  S.canvas = shadow.querySelector('canvas.display')!;
  S.ctx = S.canvas.getContext('2d')!;
  S.canvasWrap = shadow.querySelector('.canvas-wrap')!;
  S.thumbstrip = shadow.querySelector('.thumbstrip')!;
  S.descEl = shadow.querySelector('.desc')!;
  S.counterEl = shadow.querySelector('.counter')!;
  S.ghostEl = shadow.querySelector('#ghost')!;
}

// The test-player warmup downloads the whole game SWF + music, so it waits
// until the tiles have painted (or the spritesheet failed, or a timeout).
let warmed = false;
function warmOnce() {
  if (warmed) return;
  warmed = true;
  timingLog('test-player warmup start');
  warmTestPlayer();
}

function loadImages() {
  S.spritesheetImg = new Image();
  S.spritesheetImg.onload = () => {
    timingLog(`spritesheet onload${resourceMs(SPRITESHEET_URL)}`);
    buildThumbnails();
    draw();
    warmOnce();
  };
  S.spritesheetImg.onerror = () => {
    timingLog('spritesheet onerror, warming test player anyway');
    warmOnce();
  };
  setTimeout(warmOnce, WARMUP_TIMEOUT_MS);
  timingLog('spritesheet fetch start');
  S.spritesheetImg.src = SPRITESHEET_URL;

  S.gloweyImg = new Image();
  S.gloweyImg.onload = () => { draw(); };
  S.gloweyImg.src = '/editors/assets/glowey.png';

  preloadSprites(() => { buildThumbnails(); draw(); });
}

function focusNameInput(shadow: ShadowRoot) {
  const input = shadow.querySelector('.start-name') as HTMLInputElement | null;
  input?.focus();
  input?.select();
}

// ?load=<id> (from My Levels) opens a saved level directly. The start
// overlay is hidden up front so it never flashes, and reappears on failure.
function openRequestedLevel(shadow: ShadowRoot): boolean {
  const raw = new URLSearchParams(location.search).get('load');
  const loadId = raw && /^[\w-]{1,128}$/.test(raw) ? raw : null;
  if (!loadId) return false;
  const overlay = () => shadow.querySelector('.start-overlay');
  overlay()?.classList.add('hidden');
  loadLevelById(loadId).then((ok) => {
    if (ok) {
      timingLog('opened saved level');
      return;
    }
    overlay()?.classList.remove('hidden');
    focusNameInput(shadow);
  });
  return true;
}

function boot() {
  timingLog(`boot DOMContentLoaded readyState=${document.readyState}`);
  console.log('[editor] build 20260913T1849 (object subtypes + thumb-blit canvas)');
  const host = document.getElementById('gamecontainer');
  if (!host) return;
  unregisterLegacyServiceWorker();
  const shadow = mountShadow(host);
  S.shadow = shadow;
  if (isMobileDevice()) {
    blockMobileEditor(shadow);
    return;
  }
  bindDomRefs(shadow);
  initGrid();
  initGhostCanvas();
  loadImages();
  wireEvents();
  if (!openRequestedLevel(shadow)) focusNameInput(shadow);
  // Deferred so the Shadow DOM layout is computed before the first paint.
  requestAnimationFrame(() => {
    resizeCanvas();
    updateCounter();
    switchTab('tiles');
    timingLog('first paint (tiles tab)');
  });
}

document.addEventListener('DOMContentLoaded', boot);
