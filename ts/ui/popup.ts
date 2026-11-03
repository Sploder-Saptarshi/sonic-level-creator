// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi


import { query } from '../core/dom';

export function showPopup(title: string, msg: string, showOk: boolean) {
  const overlay = query('.save-overlay');
  const titleEl = query('.save-overlay .save-title');
  const msgEl = query('.save-overlay .save-msg');
  const ok = query('.save-overlay .save-ok');
  if (!overlay || !titleEl || !msgEl || !ok) return;
  titleEl.textContent = title;
  msgEl.textContent = msg;
  ok.classList.toggle('hidden', !showOk);
  overlay.classList.remove('hidden');
}

export function hidePopup() {
  query('.save-overlay')?.classList.add('hidden');
}

export const showSaveSaving = () => showPopup('Saving...', 'Please wait while your level is saved.', false);
export const showSaveComplete = (msg: string) => showPopup('Save complete', msg, true);
export const showSaveError = (msg: string) => showPopup('Cannot save', msg, true);
export const showTestError = (msg: string) => showPopup('Cannot test', msg, true);
export const showPlaceError = (msg: string) => showPopup('Cannot place object', msg, true);
export const showDeleteError = (msg: string) => showPopup('Cannot delete tile', msg, true);
