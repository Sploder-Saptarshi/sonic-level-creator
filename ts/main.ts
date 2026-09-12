// ts/main.ts — Boot: create Shadow DOM, initialise state, wire events

import { DEFAULT_COLS, DEFAULT_ROWS } from './format';
import { S, initGrid, cellSize, setStatus, updateDesc } from './state';
import { EDITOR_CSS, EDITOR_HTML } from './ui';
import { draw, initGhostCanvas } from './render';
import { buildThumbnails, switchTab, updateCounter } from './thumbnails';
import { resizeCanvas } from './actions';
import { wireEvents } from './events';

function boot() {
  const host = document.getElementById('gamecontainer');
  if (!host) return;

  const shadow = host.attachShadow({ mode: 'open' });
  S.shadow = shadow;

  // Inject style
  const style = document.createElement('style');
  style.textContent = EDITOR_CSS;
  shadow.appendChild(style);

  // Inject HTML
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'height:100%;display:flex;flex-direction:column;';
  wrapper.innerHTML = EDITOR_HTML;
  shadow.appendChild(wrapper);

  // Grab DOM refs into state
  S.canvas = shadow.querySelector('canvas.display')!;
  S.ctx = S.canvas.getContext('2d')!;
  S.canvasWrap = shadow.querySelector('.canvas-wrap')!;
  S.thumbstrip = shadow.querySelector('.thumbstrip')!;
  S.descEl = shadow.querySelector('.desc')!;
  S.statusEl = shadow.querySelector('.status')!;
  S.counterEl = shadow.querySelector('.counter')!;
  S.ghostEl = shadow.querySelector('.ghost')!;

  initGrid();
  initGhostCanvas();

  // Load spritesheet
  S.spritesheetImg = new Image();
  S.spritesheetImg.onload = () => { buildThumbnails(); draw(); };
  S.spritesheetImg.src = '/editors/assets/spritesheet.png';

  // Wire all event handlers
  wireEvents();

  // First paint — defer to let Shadow DOM layout compute
  requestAnimationFrame(() => {
    resizeCanvas();
    updateCounter();
    switchTab('tiles');
  });
}

document.addEventListener('DOMContentLoaded', boot);
