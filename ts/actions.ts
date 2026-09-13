// ts/actions.ts — Save, test, fullscreen, clear, resize, zoom

import { encodeBin, encodeAct, toCSV } from './format';
import { S, cellSize, initGrid } from './state';
import { draw } from './render';
import { updateCounter } from './thumbnails';

// ── Validation ──

function hasSonic(): boolean {
  return S.objects.some(o => o.type === 151);
}

function hasGoal(): boolean {
  return S.objects.some(o => o.type === 44);
}

// ── Actions ──

export async function doSave() {
  const sonics = S.objects.filter(o => o.type === 151).length;
  const goals = S.objects.filter(o => o.type === 44).length;
  if (sonics === 0) return;
  if (goals === 0) return;
  if (sonics > 1) return;
  if (goals > 1) return;
  try {
    const bin = encodeBin(S.grid);
    const act = encodeAct(S.objects);
    await fetch('/editors/save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: toCSV(bin, act),
    });
  } catch (_) { /* save failed — game requires Sonic + goal present */ }
}

export async function doTest() {
  if (!hasSonic() || !hasGoal()) return;
  await doSave();
  window.open('/', '_blank');
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
