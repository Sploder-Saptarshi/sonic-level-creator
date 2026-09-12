// ts/actions.ts — Save, test, fullscreen, clear, resize, zoom

import { encodeBin, encodeAct, toCSV } from './format';
import { S, cellSize, setStatus, initGrid } from './state';
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
  if (!hasSonic()) { setStatus('Error: Sonic Placer (spawn) is required!'); return; }
  if (!hasGoal()) { setStatus('Error: Sign Post (goal) is required!'); return; }
  setStatus('Saving...');
  try {
    const bin = encodeBin(S.grid);
    const act = encodeAct(S.objects);
    const resp = await fetch('/editors/save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: toCSV(bin, act),
    });
    const r = await resp.json();
    setStatus(r.ok ? `Saved! (${r.binBytes}B BIN + ${r.actBytes}B ACT)` : `Save error: ${r.error}`);
  } catch (err: any) {
    setStatus(`Save failed: ${err.message}`);
  }
}

export async function doTest() {
  if (!hasSonic() || !hasGoal()) {
    setStatus('Error: Sonic Placer + Sign Post required to test!');
    return;
  }
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
  setStatus('Level cleared');
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
