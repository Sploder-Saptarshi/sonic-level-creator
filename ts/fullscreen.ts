// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { S } from './state';
import { query } from './dom';

const PLAYER_SELECTOR = '.ruffle-holder ruffle-player, .ruffle-holder ruffle-object';

let cachedTestScale: number | null = null;

// Scales the 640x448 test player to fill its holder, or the screen in fullscreen.
export function fitTestRuffle() {
  const holder = query('.ruffle-holder');
  const player = query(PLAYER_SELECTOR);
  if (!player || !holder) return;
  if (!query('.testmode')?.classList.contains('active')) {
    player.style.transform = '';
    return;
  }
  const isFull = document.fullscreenElement === S.shadow?.host;
  const width = isFull ? window.innerWidth : holder.clientWidth;
  const height = isFull ? window.innerHeight : holder.clientHeight;
  if (width && height) cachedTestScale = Math.min(width / 640, height / 448);
  if (cachedTestScale) player.style.transform = `scale(${cachedTestScale})`;
}

// avoids a frame at 640x448 before the holder is laid out
export function applyCachedTestScale() {
  const player = query(PLAYER_SELECTOR);
  if (player && cachedTestScale) player.style.transform = `scale(${cachedTestScale})`;
}

export function scheduleFit() {
  requestAnimationFrame(() => {
    fitTestRuffle();
    requestAnimationFrame(fitTestRuffle);
  });
  setTimeout(fitTestRuffle, 30);
}

export function doFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else (S.shadow!.host as HTMLElement).requestFullscreen().catch(() => {});
  scheduleFit();
}

export function watchTestPlayerFit() {
  document.addEventListener('fullscreenchange', fitTestRuffle);
  window.addEventListener('resize', fitTestRuffle);
  const holder = query('.ruffle-holder');
  if (holder) new ResizeObserver(fitTestRuffle).observe(holder);
}
