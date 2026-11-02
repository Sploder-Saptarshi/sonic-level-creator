// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import { S, initGrid } from './state';
import { updateCounter } from './thumbnails';
import { query, queryAll } from './dom';
import { showEditor, updateCreatorHeading } from './levelStore';

function startCreating() {
  const input = query<HTMLInputElement>('.start-name');
  S.levelName = (input?.value ?? '').trim();
  if (!S.levelName) return;
  updateCreatorHeading();
  input?.blur();
  query('.start-card')?.setAttribute('hidden', '');
  query('.size-card')?.removeAttribute('hidden');
}

function selectMapSize(el: Element) {
  const cols = parseInt(el.getAttribute('data-cols') || '35', 10);
  const rows = parseInt(el.getAttribute('data-rows') || '8', 10);
  initGrid(cols, rows);
  updateCounter();
  showEditor();
}

export function focusNameInput() {
  const input = query<HTMLInputElement>('.start-name');
  input?.focus();
  input?.select();
}

function wireNameStep() {
  const nameInput = query<HTMLInputElement>('.start-name');
  const startBtn = query<HTMLButtonElement>('.start-go');
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startCreating();
  });
  nameInput?.addEventListener('input', () => {
    if (startBtn) startBtn.disabled = !nameInput.value.trim();
  });
  query('[data-action="startcreating"]')?.addEventListener('click', startCreating);
}

function previewMapSize(region: Element) {
  for (const o of queryAll('.map-opt.map-hover')) {
    if (o !== region) o.classList.remove('map-hover');
  }
  region.classList.add('map-hover');
  const name = query('.map-label .map-name');
  const dims = query('.map-label .map-dims');
  if (name) name.textContent = region.getAttribute('data-name') ?? '';
  if (dims) dims.textContent = `${region.getAttribute('data-cols')} x ${region.getAttribute('data-rows')} tiles`;
}

// mouseenter doesn't re-fire when moving outward between nested regions
function wireSizeStep() {
  const mapArea = query('.map-area');
  mapArea?.addEventListener('mouseover', (e) => {
    const region = (e.target as Element).closest?.('.map-opt');
    if (region && mapArea.contains(region)) previewMapSize(region);
  });
  for (const region of queryAll('.map-opt')) {
    region.addEventListener('click', (e) => { e.stopPropagation(); selectMapSize(region); });
  }
}

export function wireStartScreens() {
  wireNameStep();
  wireSizeStep();
}
