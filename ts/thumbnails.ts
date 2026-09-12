// ts/thumbnails.ts — Thumbnail strip, tabs, counter, desc

import { BLOCK_PX, USED_BLOCKS, MAX_OBJECTS_PER_TILE, blockSheetXY } from './format';
import {
  S, cellSize, defsForTab, totalObjects, countPlacedTiles,
  pixelToTile, objectsInTile, setStatus, updateDesc,
} from './state';
import { draw } from './render';

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
      el.className = 'thumb thumb-txt';
      el.title = def.desc;
      el.textContent = def.name;
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        S.selectedObj = def;
        S.selectedObjIdx = -1;
        S.paletteDrag = true;
        S.paletteDragDef = def;
        updateDesc(`${def.name}: ${def.desc}`);
        draw();
      });
      thumbstrip.appendChild(el);
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
