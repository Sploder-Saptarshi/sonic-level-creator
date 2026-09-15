// ts/main.ts — Boot: create Shadow DOM, initialise state, wire events

import { DEFAULT_COLS, DEFAULT_ROWS } from './format';
import { S, initGrid, cellSize, updateDesc } from './state';
import { EDITOR_CSS, EDITOR_HTML } from './ui';
import { draw, initGhostCanvas } from './render';
import { preloadSprites } from './sprites';
import { buildThumbnails, switchTab, updateCounter } from './thumbnails';
import { resizeCanvas, warmTestPlayer } from './actions';
import { wireEvents } from './events';

function boot() {
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
  S.spritesheetImg.onload = () => { buildThumbnails(); draw(); };
  S.spritesheetImg.src = '/editors/assets/spritesheet.png';

  // Load hover glow overlay (drawn on top of the hovered filled tile)
  S.gloweyImg = new Image();
  S.gloweyImg.onload = () => { draw(); };
  S.gloweyImg.src = '/editors/assets/glowey.png';

  // Load object sprites (redraw thumbnails + canvas as each arrives)
  preloadSprites(() => { buildThumbnails(); draw(); });

  // Wire all event handlers
  wireEvents();

  // Boot the test player muted in the background so Test opens warm.
  warmTestPlayer();

  // First paint — defer to let Shadow DOM layout compute
  requestAnimationFrame(() => {
    resizeCanvas();
    updateCounter();
    switchTab('tiles');
  });
}

document.addEventListener('DOMContentLoaded', boot);
