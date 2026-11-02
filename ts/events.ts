// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { S, type TabType } from './state';
import { switchTab, wireTrayScroll } from './thumbnails';
import { query, queryAll } from './dom';
import { hidePopup } from './popup';
import { doClearAll, doSave, doShare } from './levelStore';
import { doTest, stopTest } from './testMode';
import { doFullscreen } from './fullscreen';
import { resizeCanvas, setZoom } from './viewport';
import { wireCanvasInput } from './canvasInput';
import { wirePaletteDrop } from './paletteDrop';

const ACTIONS: Record<string, () => void> = {
  save: () => { doSave(); },
  test: () => { doTest(); },
  stoptest: stopTest,
  fullscreen: doFullscreen,
  mylevels: () => { location.href = '/editors/mylevels'; },
  alllevels: () => { location.href = '/editors/alllevels'; },
  share: () => { doShare(); },
  saveok: hidePopup,
};

function wireButtons() {
  for (const b of queryAll('[data-zoom]')) {
    b.addEventListener('click', () => setZoom(parseFloat(b.getAttribute('data-zoom') || '1')));
  }
  for (const b of queryAll('.tab')) {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab') as TabType));
  }
  for (const b of queryAll('[data-action]')) {
    const action = ACTIONS[b.getAttribute('data-action') ?? ''];
    if (action) b.addEventListener('click', action);
  }
  query('.btn-clear')?.addEventListener('click', doClearAll);
}

// the new size is only measurable after layout settles
function wireResizing() {
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('fullscreenchange', () => {
    requestAnimationFrame(() => requestAnimationFrame(resizeCanvas));
  });
}

export function wireEvents() {
  wireCanvasInput(S.canvas!, S.canvasWrap!);
  wirePaletteDrop();
  wireButtons();
  wireResizing();
  wireTrayScroll();
}
