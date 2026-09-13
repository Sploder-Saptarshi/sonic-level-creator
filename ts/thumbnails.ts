// ts/thumbnails.ts — Thumbnail strip, tabs, counter, desc

import { BLOCK_PX, USED_BLOCKS, MAX_OBJECTS_PER_TILE, blockSheetXY } from './format';
import {
  S, cellSize, defsForTab, totalObjects, countPlacedTiles,
  pixelToTile, objectsInTile, setStatus, updateDesc,
} from './state';
import { draw } from './render';
import { partsFor, paintThumb, isMirrored } from './sprites';

export function updateCounter() {
  if (!S.counterEl) return;
  const totalTiles = S.grid.length * (S.grid[0]?.length || 0);
  const placedTiles = countPlacedTiles();
  S.counterEl.textContent = `${totalObjects()}/${placedTiles}`;
}

export function buildThumbnails() {
  const { thumbstrip, spritesheetImg, activeTab } = S;
  if (!thumbstrip) return;
  thumbstrip.innerHTML = '';

  if (activeTab === 'tiles') {
    // Palette: blocks 1–107 only (108+ unused), excluding block 7.
    for (let i = 1; i <= 107 && i < USED_BLOCKS; i++) {
      if (i === 7) continue;
      const el = document.createElement('div');
      el.className = 'thumb';
      el.title = `Block ${i}`;
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
      el.title = def.desc + (noArt ? ' (invisible in-game: no art in this zone)' : '');
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
        S.paletteDrag = true;
        S.paletteDragDef = def;
        updateDesc(`${def.name}: ${def.desc}` + (noArt ? ' (invisible in-game: no art in this zone)' : ''));
        draw();
      });
      thumbstrip.appendChild(el);
      if (cvs) {
        // Deterministic 1x sizing with proportional shrink-only, measured
        // from the live box (post-append, so layout is real): immune to
        // flex/aspect-ratio/max-clamp quirks, so art can never be
        // squeezed on one axis.
        const boxH = el.clientHeight - 2, boxW = el.clientWidth - 2;
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
  S.shadow!.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('tab-active', b.getAttribute('data-tab') === tab);
  });
  buildThumbnails();
  updateDesc(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab — select an item below`);
  draw();
}
