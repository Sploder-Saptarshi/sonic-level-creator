// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import EDITOR_CSS from './ui/editor.css' with { type: 'text' };
import EDITOR_HTML from './ui/editor.html' with { type: 'text' };
import { S, initGrid } from './core/state';
import { draw, initGhostCanvas } from './render/render';
import { preloadSprites } from './render/sprites';
import { buildThumbnails, switchTab, updateCounter } from './ui/thumbnails';
import { wireEvents } from './input/events';
import { query } from './core/dom';
import { resourceMs, timingLog } from './core/timing';
import { blockMobileEditor, isMobileDevice } from './ui/mobileGate';
import { focusNameInput, wireStartScreens } from './ui/startScreen';
import { loadLevelById } from './level/levelStore';
import { warmTestPlayer } from './playtest/testMode';
import { watchTestPlayerFit } from './playtest/fullscreen';
import { resizeCanvas } from './ui/viewport';

const SPRITESHEET_URL = '/editors/assets/spritesheet.png';
const WARMUP_TIMEOUT_MS = 15000;

// Older builds used a service worker that could shadow the gateway.
function unregisterLegacyServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration('/').then((r) => r?.unregister()).catch(() => {});
}

function mountShadow(host: HTMLElement): ShadowRoot {
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  shadow.appendChild(style);
  const wrapper = document.createElement('div');
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

// The warmup downloads the whole game, so let the tiles load first.
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

function openRequestedLevel(): boolean {
  const raw = new URLSearchParams(location.search).get('load');
  const loadId = raw && /^[\w-]{1,128}$/.test(raw) ? raw : null;
  if (!loadId) return false;
  query('.start-overlay')?.classList.add('hidden');
  loadLevelById(loadId).then((ok) => {
    if (ok) {
      timingLog('opened saved level');
      return;
    }
    query('.start-overlay')?.classList.remove('hidden');
    focusNameInput();
  });
  return true;
}

function boot() {
  timingLog(`boot DOMContentLoaded readyState=${document.readyState}`);
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
  wireStartScreens();
  watchTestPlayerFit();
  if (!openRequestedLevel()) focusNameInput();
  requestAnimationFrame(() => {
    resizeCanvas();
    updateCounter();
    switchTab('tiles');
    timingLog('first paint (tiles tab)');
  });
}

document.addEventListener('DOMContentLoaded', boot);
