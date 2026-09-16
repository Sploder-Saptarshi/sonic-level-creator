// ts/thumbnails.ts — Thumbnail strip, tabs, counter, desc

import { BLOCK_PX, USED_BLOCKS, MAX_OBJECTS_PER_TILE, blockSheetXY } from './format';
import {
  S, cellSize, defsForTab, totalObjects, countPlacedTiles,
  pixelToTile, objectsInTile, updateDesc,
} from './state';
import { draw } from './render';
import { partsFor, paintThumb, isMirrored } from './sprites';
import { TOOLTIPS } from './tooltipTexts';

// ── Custom tooltip (replaces native title) ──
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
  // Append to shadow root so fixed positioning escapes thumbstrip overflow.
  // Fallback to document.body outside shadow context.
  const host = S.shadow as unknown as HTMLElement | null;
  if (host && (host as any).appendChild) {
    (S.shadow as unknown as ShadowRoot).appendChild(tipEl);
  } else {
    document.body.appendChild(tipEl);
  }
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
  // Measure after content is set but before visible (off-screen measure).
  el.style.left = '0';
  el.style.top = '-9999px';
  el.classList.add('visible');
  el.style.visibility = 'hidden';
  const tr = el.getBoundingClientRect();
  el.style.visibility = '';
  el.classList.remove('visible');
  const gap = 2;
  // Arrow's thumb anchor stays at 30% of the square from its left; the
  // tooltip's arrow sits with a small left gap (30px from tooltip left).
  // Keep that anchor even when the bubble is viewport-clamped.
  const ARROW_GAP = 30;
  const thumbArrowX = r.left + r.width * 0.30;
  let left = thumbArrowX - ARROW_GAP;
  let top = r.top - tr.height - gap;
  const pad = 4;
  left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
  // If not enough space above, flip below (keeps tooltip on-screen).
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

function tooltipForTile(blockId: number): string {
  const t = TOOLTIPS.find(e => e.id === -1 && (e.sub ?? 0) === blockId);
  return t ? `${t.name}: ${t.desc}` : "";
}

function tooltipForDef(def: { id: number; name: string; desc: string; variant?: number; sub?: number }): string {
  const t = findTip(def.id, def.variant ?? 0, def.sub ?? 0);
  return t ? `${t.name}: ${t.desc}` : "";
}

export function updateCounter() {
  if (!S.counterEl) return;
  const totalTiles = S.grid.length * (S.grid[0]?.length || 0);
  const placedTiles = countPlacedTiles();
  S.counterEl.textContent = `${totalObjects()}/${placedTiles}`;
}

export function buildThumbnails() {
  hideTip();
  const { thumbstrip, spritesheetImg, activeTab } = S;
  if (!thumbstrip) return;
  thumbstrip.innerHTML = '';

  if (activeTab === 'tiles') {
    // Palette: blocks 1–107 only (108+ unused), excluding block 7.
    for (let i = 1; i <= 107 && i < USED_BLOCKS; i++) {
      if (i === 7) continue;
      const el = document.createElement('div');
      el.className = 'thumb';
      attachTip(el, tooltipForTile(i));
      const cvs = document.createElement('canvas');
      cvs.width = BLOCK_PX;
      cvs.height = BLOCK_PX;
      const c = cvs.getContext('2d')!;
      if (spritesheetImg?.complete) {
        const { x: sx, y: sy } = blockSheetXY(i);
        c.drawImage(spritesheetImg, sx, sy, BLOCK_PX, BLOCK_PX, 0, 0, BLOCK_PX, BLOCK_PX);
      }
      el.appendChild(cvs);
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        S.selectedTile = i;
        S.selectedObj = null;
        S.selectedObjIdx = -1;
        S.selectedTileBx = -1;
        S.selectedTileBy = -1;
        S.paletteDrag = true;
        S.paletteDragTile = i;
        updateDesc(`Block ${i} — drag onto grid to place`);
        draw();
      });
      thumbstrip.appendChild(el);
    }
  } else {
    for (const def of defsForTab(activeTab)) {
      const el = document.createElement('div');
      const sub = def.sub ?? 0, variant = def.variant ?? 0;
      const mirror = !!def.mirror || isMirrored(def.id, variant, sub);
      const noArt = !partsFor(def.id, sub, variant);
      const baseTip = tooltipForDef(def);
      const tipText = baseTip + (noArt ? ' (invisible in-game: no art in this zone)' : '');
      attachTip(el, tipText);
      const parts = partsFor(def.id, sub, variant);
      let cvs: HTMLCanvasElement | null = null;
      if (parts) {
        // True-sprite thumbnail (transparent bg, 1x integer scale, pixel-crisp)
        el.className = 'thumb thumb-obj';
        cvs = document.createElement('canvas');
        paintThumb(cvs.getContext('2d')!, parts, 1, mirror);
        el.appendChild(cvs);
      } else {
        // Game-invisible type (no zone art / no draw routine): labeled box
        el.className = 'thumb thumb-txt';
        el.textContent = def.name;
      }
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        S.selectedObj = def;
        S.selectedObjIdx = -1;
        S.selectedTileBx = -1;
        S.selectedTileBy = -1;
        S.paletteDrag = true;
        S.paletteDragDef = def;
        updateDesc(`${def.name}: ${def.desc}` + (noArt ? ' (invisible in-game: no art in this zone)' : ''));
        draw();
      });
      thumbstrip.appendChild(el);
      if (cvs) {
        // Deterministic 1x sizing with proportional shrink-only into the
        // 80% bounding box (see .thumb canvas CSS), measured from the live
        // box (post-append, so layout is real): immune to
        // flex/aspect-ratio/max-clamp quirks, so art can never be
        // squeezed on one axis.
        const boxH = el.clientHeight * 0.8, boxW = el.clientWidth * 0.8;
        if (boxH > 0 && boxW > 0 && cvs.width > 0 && cvs.height > 0) {
          const s = Math.min(1, boxW / cvs.width, boxH / cvs.height);
          cvs.style.width = Math.max(1, Math.floor(cvs.width * s)) + 'px';
          cvs.style.height = Math.max(1, Math.floor(cvs.height * s)) + 'px';
        }
      }
    }
  }
}

export function switchTab(tab: S['activeTab']) {
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
