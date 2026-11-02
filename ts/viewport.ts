// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { S, cellSize } from './state';
import { draw } from './render';
import { query, queryAll } from './dom';

// A full-grid canvas falls off GPU acceleration, so the canvas only covers
// the viewport and .canvas-inner provides the scroll range.
export function resizeCanvas() {
  if (!S.canvas || !S.canvasWrap || !S.grid.length) return;
  const viewW = S.canvasWrap.clientWidth, viewH = S.canvasWrap.clientHeight;
  if (viewW > 0 && viewH > 0) {
    S.canvas.width = viewW;
    S.canvas.height = viewH;
    const inner = query('.canvas-inner');
    if (inner) {
      inner.style.width = S.grid[0].length * cellSize() + 'px';
      inner.style.height = S.grid.length * cellSize() + 'px';
    }
  }
  draw();
}

export function setZoom(z: number) {
  S.zoom = z;
  for (const b of queryAll('[data-zoom]')) {
    b.classList.toggle('btn-active', parseFloat(b.getAttribute('data-zoom') || '0') === z);
  }
  resizeCanvas();
}
