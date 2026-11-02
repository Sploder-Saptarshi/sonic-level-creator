// Palette tray, tabs, tooltips and the object counter.

import { BLOCK_PX, USED_BLOCKS, blockSheetXY, type ObjectDef } from './format';
import {
  S, defsForTab, totalObjects, countPlacedTiles,
  updateDesc, type TabType,
} from './state';
import { draw } from './render';
import { partsFor, paintThumb, isMirrored } from './sprites';
import { TOOLTIPS } from './tooltipTexts';
import { timingLog } from './main';

const NO_ART_NOTE = ' (invisible in-game: no art in this zone)';

// Logged only on change: sprite arrivals rebuild the tray often.
let lastThumbLog = '';

// ── Tooltip ──
let tipEl: HTMLElement | null = null;
let tipTimer: ReturnType<typeof setTimeout> | null = null;
let tipAnchor: HTMLElement | null = null;

function ensureTip(): HTMLElement {
  if (tipEl && tipEl.isConnected) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'obj-tooltip';
  tipEl.setAttribute('role', 'tooltip');
  const text = document.createElement('div');
  text.className = 'tip-text';
  const bottom = document.createElement('div');
  bottom.className = 'tip-bottom';
  tipEl.appendChild(text);
  tipEl.appendChild(bottom);
  // Fixed positioning in the shadow root escapes the tray's overflow clip.
  (S.shadow ?? document.body).appendChild(tipEl);
  return tipEl;
}

function tipTextEl(): HTMLElement {
  const el = ensureTip();
  return el.querySelector('.tip-text') as HTMLElement;
}

function hideTip() {
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
  tipAnchor = null;
  if (tipEl) tipEl.classList.remove('visible');
}

function positionTip(anchor: HTMLElement) {
  const el = ensureTip();
  const r = anchor.getBoundingClientRect();
  // Measure offscreen before showing.
  el.style.left = '0';
  el.style.top = '-9999px';
  el.classList.add('visible');
  el.style.visibility = 'hidden';
  const tr = el.getBoundingClientRect();
  el.style.visibility = '';
  el.classList.remove('visible');
  const gap = 2;
  // The arrow points at 30% across the thumb, even when the bubble is
  // clamped to the viewport.
  const ARROW_GAP = 30;
  const thumbArrowX = r.left + r.width * 0.30;
  let left = thumbArrowX - ARROW_GAP;
  let top = r.top - tr.height - gap;
  const pad = 4;
  left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
  // Flip below when there is no room above.
  if (top < pad) top = r.bottom + gap;
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
  const arrowOffset = thumbArrowX - (left + ARROW_GAP);
  el.style.setProperty('--tip-arrow-offset', arrowOffset + 'px');
  requestAnimationFrame(() => el.classList.add('visible'));
}

function scheduleTip(text: string, anchor: HTMLElement) {
  hideTip();
  tipAnchor = anchor;
  tipTextEl().textContent = text;
  tipTimer = setTimeout(() => {
    if (tipAnchor !== anchor) return;
    positionTip(anchor);
  }, 450);
}

function attachTip(el: HTMLElement, text: string) {
  el.addEventListener('mouseenter', () => scheduleTip(text, el));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('mousedown', hideTip);
  el.addEventListener('wheel', hideTip, { passive: true } as any);
}

function findTip(id: number, variant = 0, sub = 0): { name: string; desc: string } | undefined {
  return TOOLTIPS.find(t => t.id === id && (t.variant ?? 0) === variant && (t.sub ?? 0) === sub)
      ?? TOOLTIPS.find(t => t.id === id && (t.variant ?? 0) === variant)
      ?? TOOLTIPS.find(t => t.id === id);
}

function tooltipForDef(def: ObjectDef): string {
  const t = findTip(def.id, def.variant ?? 0, def.sub ?? 0);
  return t ? `${t.name}: ${t.desc}` : "";
}

export function updateCounter() {
  if (!S.counterEl) return;
  S.counterEl.textContent = `${totalObjects()}/${countPlacedTiles()}`;
}

function clearSelectionForDrag() {
  S.selectedObjIdx = -1;
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
  S.paletteDrag = true;
}

function tileThumb(blockId: number): { el: HTMLElement; painted: boolean } {
  const el = document.createElement('div');
  el.className = 'thumb';
  const cvs = document.createElement('canvas');
  cvs.width = BLOCK_PX;
  cvs.height = BLOCK_PX;
  const img = S.spritesheetImg;
  const painted = !!img?.complete;
  if (painted) {
    const { x: sx, y: sy } = blockSheetXY(blockId);
    cvs.getContext('2d')!.drawImage(img!, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, BLOCK_PX, BLOCK_PX);
  }
  el.appendChild(cvs);
  el.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    S.selectedTile = blockId;
    S.selectedObj = null;
    clearSelectionForDrag();
    S.paletteDragTile = blockId;
    updateDesc(`Block ${blockId} — drag onto grid to place`);
    draw();
  });
  return { el, painted };
}

// Types the game never draws get a labelled box instead of art.
function objectThumb(def: ObjectDef): { el: HTMLElement; cvs: HTMLCanvasElement | null } {
  const el = document.createElement('div');
  const sub = def.sub ?? 0, variant = def.variant ?? 0;
  const parts = partsFor(def.id, sub, variant);
  const note = parts ? '' : NO_ART_NOTE;
  attachTip(el, tooltipForDef(def) + note);
  let cvs: HTMLCanvasElement | null = null;
  if (parts) {
    el.className = 'thumb thumb-obj';
    cvs = document.createElement('canvas');
    paintThumb(cvs.getContext('2d')!, parts, 1, !!def.mirror || isMirrored(def.id, variant, sub));
    el.appendChild(cvs);
  } else {
    el.className = 'thumb thumb-txt';
    el.textContent = def.name;
  }
  el.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    S.selectedObj = def;
    clearSelectionForDrag();
    S.paletteDragDef = def;
    updateDesc(`${def.name}: ${def.desc}` + note);
    draw();
  });
  return { el, cvs };
}

// Shrinks art (never enlarges it) to fit 80% of the thumb, measured from the
// live box after it's in the tray, so it's never squeezed on one axis.
function fitThumbCanvas(el: HTMLElement, cvs: HTMLCanvasElement) {
  const boxH = el.clientHeight * 0.8, boxW = el.clientWidth * 0.8;
  if (boxH <= 0 || boxW <= 0 || cvs.width <= 0 || cvs.height <= 0) return;
  const s = Math.min(1, boxW / cvs.width, boxH / cvs.height);
  cvs.style.width = Math.max(1, Math.floor(cvs.width * s)) + 'px';
  cvs.style.height = Math.max(1, Math.floor(cvs.height * s)) + 'px';
}

// Blocks 1-107, minus the unused 7, 35 and 71.
function paletteBlockIds(): number[] {
  const ids: number[] = [];
  for (let i = 1; i <= 107 && i < USED_BLOCKS; i++) {
    if (i !== 7 && i !== 35 && i !== 71) ids.push(i);
  }
  return ids;
}

export function buildThumbnails() {
  hideTip();
  const { thumbstrip, activeTab } = S;
  if (!thumbstrip) return;
  thumbstrip.innerHTML = '';
  let painted = 0, total = 0;
  if (activeTab === 'tiles') {
    for (const id of paletteBlockIds()) {
      const thumb = tileThumb(id);
      if (thumb.painted) painted++;
      total++;
      thumbstrip.appendChild(thumb.el);
    }
  } else {
    for (const def of defsForTab(activeTab)) {
      const { el, cvs } = objectThumb(def);
      if (cvs) painted++;
      thumbstrip.appendChild(el);
      total++;
      if (cvs) fitThumbCanvas(el, cvs);
    }
  }
  const summary = `${activeTab} painted=${painted}/${total}`;
  if (summary !== lastThumbLog) {
    lastThumbLog = summary;
    timingLog(`thumbnails ${summary}`);
  }
}

export function switchTab(tab: TabType) {
  S.activeTab = tab;
  S.selectedObj = null;
  S.selectedObjIdx = -1;
  S.selectedTileBx = -1;
  S.selectedTileBy = -1;
  S.shadow!.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('tab-active', b.getAttribute('data-tab') === tab);
  });
  buildThumbnails();
  updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab — select an item below`);
  draw();
}
