import { decodeLevel, encodeCompact } from './format';
import { S, clearSelection, initGrid, updateDesc } from './state';
import { draw } from './render';
import { updateCounter } from './thumbnails';
import { query } from './dom';
import { ensureValid, levelCSV } from './levelData';
import { showPopup, showSaveComplete, showSaveError, showSaveSaving } from './popup';
import { markDirty } from './testMode';
import { resizeCanvas } from './viewport';

function isSignedIn(): boolean {
  const boot = window.__PLAYSEGA__;
  return !!boot?.username && boot.username !== 'Guest';
}

export function updateCreatorHeading() {
  const el = document.querySelector('#box3 h3 .fancy');
  if (el) {
    el.textContent = S.levelName
      ? `Sonic The Hedgehog Level Creator - ${S.levelName}`
      : 'Sonic The Hedgehog Level Creator';
  }
}

function hideShareButton() {
  const btn = query('[data-action="share"]');
  if (btn) btn.style.display = 'none';
}

export function showEditor() {
  query('.start-overlay')?.classList.add('hidden');
  resizeCanvas();
}

interface LevelRow {
  name?: unknown;
  data?: unknown;
  published?: unknown;
}

async function fetchLevel(id: string): Promise<LevelRow | null> {
  try {
    const res = await fetch(`/api/levels/${id}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { level?: LevelRow };
    return body.level ?? null;
  } catch {
    return null;
  }
}

export async function loadLevelById(id: string): Promise<boolean> {
  if (!/^[\w-]{1,128}$/.test(id)) return false;
  const row = await fetchLevel(id);
  const parsed = row && typeof row.data === 'string' ? decodeLevel(row.data) : null;
  if (!row || !parsed) return false;
  S.grid = parsed.grid;
  S.objects = parsed.objects;
  if (typeof row.name === 'string' && row.name.trim()) S.levelName = row.name.trim();
  updateCreatorHeading();
  S.levelId = id;
  if (row.published) hideShareButton();
  clearSelection();
  updateCounter();
  markDirty();
  showEditor();
  return true;
}

async function saveToServer(): Promise<boolean> {
  const payload = {
    name: S.levelName,
    cols: S.grid[0].length,
    rows: S.grid.length,
    data: encodeCompact(S.grid, S.objects),
  };
  try {
    const res = await fetch(S.levelId ? `/api/levels/${S.levelId}` : '/api/levels', {
      method: S.levelId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const saved = (await res.json()) as { id?: string };
    if (saved.id) S.levelId = saved.id;
    return true;
  } catch {
    return false;
  }
}

function pinLoadParam() {
  if (!S.levelId) return;
  const url = new URL(location.href);
  if (url.searchParams.get('load') === S.levelId) return;
  url.searchParams.set('load', S.levelId);
  history.replaceState(null, '', url);
}

function downloadCSV(csv: string) {
  const blob = new Blob([csv], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = S.levelName.trim().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  a.download = (slug || 'custom-level') + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function doSave(opts?: { publishFlow?: boolean }): Promise<boolean> {
  if (!ensureValid(showSaveError)) return false;
  if (!S.levelName) {
    updateDesc('Name your level on the start screen first.');
    showSaveComplete('Name your level on the start screen first.');
    return false;
  }
  const csv = levelCSV();
  showSaveSaving();
  // let the overlay paint first
  await new Promise((r) => setTimeout(r, 30));
  if (!isSignedIn()) {
    downloadCSV(csv);
    updateDesc(`Saved "${S.levelName}".`);
    showSaveComplete(`"${S.levelName}" was saved.`);
    return true;
  }
  if (!(await saveToServer())) {
    updateDesc('Server save failed - try again.');
    showPopup('Save failed', 'The server did not save your level - check your connection and try again.', true);
    return false;
  }
  pinLoadParam();
  updateDesc(`Saved "${S.levelName}".`);
  if (!opts?.publishFlow) showSaveComplete(`"${S.levelName}" was saved.`);
  return true;
}

export async function doShare() {
  if (!isSignedIn()) {
    location.href = '/member/signin';
    return;
  }
  if (!ensureValid(showSaveError)) return;
  if (!confirm('Publishing is permanent. Share this level with everyone?')) return;
  const saved = await doSave({ publishFlow: true });
  if (!saved || !S.levelId) return;
  showPopup('Publishing...', 'Please wait while your level is published.', false);
  try {
    const res = await fetch(`/api/levels/${S.levelId}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(`publish failed: ${res.status}`);
    updateDesc(`Published "${S.levelName}".`);
    showPopup('Publish complete', `"${S.levelName}" was published. It now appears in All Levels.`, true);
    hideShareButton();
  } catch {
    updateDesc('Publishing failed - try again.');
    showPopup('Share failed', 'Publishing failed - check your connection and try again.', true);
  }
}

export function doClearAll() {
  if (!confirm('Clear entire level? This cannot be undone.')) return;
  initGrid();
  updateCounter();
  markDirty();
  draw();
}
