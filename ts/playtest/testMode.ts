// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// The test player is booted once in the background and kept muted so Test
// opens instantly. With editortest=1 the SWF holds its title music until
// editorStartAudio() is called.

import { updateDesc } from '../core/state';
import { draw } from '../render/render';
import { query } from '../core/dom';
import { levelCSV, levelValid, ensureValid } from '../level/levelData';
import { showTestError } from '../ui/popup';
import { resizeCanvas } from '../ui/viewport';
import { applyCachedTestScale, fitTestRuffle, scheduleFit } from './fullscreen';

const TEST_LOAD_OPTS = {
  url: '/games/swf/52/52.swf',
  parameters: { id: 'api-connector', levelid: '2914', editortest: '1' },
  backgroundColor: '#000000',
  scale: 'noscale',
  letterbox: 'off',
  forceScale: true,
};

let testPlayer: RufflePlayerElement | null = null;
let testBooting: Promise<void> | null = null;
let testReady = false;

// Ruffle defines SWF callbacks on the player element once the movie registers them.
function callEditorStartAudio() {
  testPlayer?.editorStartAudio?.();
}

function setTestVolume(v: number) {
  if (testPlayer) testPlayer.volume = v;
}

function testEls(): { mode: HTMLElement; holder: HTMLElement } | null {
  const mode = query('.testmode');
  const holder = query('.ruffle-holder');
  return mode && holder ? { mode, holder } : null;
}

function isTesting(): boolean {
  return !!testEls()?.mode.classList.contains('active');
}

function ensureTestPlayer(): boolean {
  if (testPlayer) return true;
  const els = testEls();
  if (!els) return false;
  const ruffle = window.RufflePlayer?.newest?.();
  if (!ruffle) {
    console.error('[editor] Ruffle not loaded, cannot start test mode');
    return false;
  }
  testPlayer = ruffle.createPlayer();
  els.holder.appendChild(testPlayer);
  setTestVolume(0);
  return true;
}

function bootTestMovie(force = false): Promise<void> {
  if (testReady && !force) return Promise.resolve();
  if (testBooting) return testBooting;
  const player = testPlayer;
  if (!player) return Promise.resolve();
  if (force) testReady = false;
  testBooting = (async () => {
    await player.ruffle().load({ ...TEST_LOAD_OPTS });
    testReady = true;
    const testing = isTesting();
    setTestVolume(testing ? 1 : 0);
    if (testing) callEditorStartAudio();
  })().catch((e) => {
    testReady = false;
    console.error('[editor] Ruffle load failed', e);
    throw e;
  }).finally(() => {
    testBooting = null;
  });
  testBooting.catch(() => {});
  return testBooting;
}

// Ruffle can't boot into display:none, so .warm keeps it laid out but invisible.
export function warmTestPlayer() {
  const pre = testEls();
  if (pre) pre.mode.classList.add('warm');
  if (!ensureTestPlayer()) {
    if (pre) pre.mode.classList.remove('warm');
    return;
  }
  bootTestMovie();
}

// The patched SWF reads test levels from here instead of the gateway.

let stagedCSV: string | null = null;

function publishStagedCSV(csv: string | null) {
  stagedCSV = csv;
}

window.__swfGetStagedLevel = () => stagedCSV;

let preStageTimer: ReturnType<typeof setTimeout> | null = null;

export function markDirty() {
  if (preStageTimer) clearTimeout(preStageTimer);
  preStageTimer = setTimeout(() => {
    preStageTimer = null;
    publishStagedCSV(levelValid() ? levelCSV() : null);
  }, 500);
}

function cancelPreStage() {
  if (preStageTimer) { clearTimeout(preStageTimer); preStageTimer = null; }
}

function failTest(msg: string) {
  updateDesc(msg);
  showTestError(msg);
}

// the Test click is the user gesture autoplay needs
function revealTestMode(mode: HTMLElement) {
  mode.classList.remove('warm');
  mode.classList.add('active');
  setTestVolume(1);
  callEditorStartAudio();
  applyCachedTestScale();
  scheduleFit();
}

export async function doTest() {
  if (!ensureValid(showTestError)) return;
  const els = testEls();
  if (!els || els.mode.classList.contains('active')) return;
  if (!ensureTestPlayer()) {
    failTest('The test player could not load. Check your connection and reload the page, then try again.');
    return;
  }
  cancelPreStage();
  publishStagedCSV(levelCSV());
  revealTestMode(els.mode);
  bootTestMovie().catch(() => {
    stopTest();
    failTest('The test player failed to start. Reload the page and try again.');
  });
}

export function stopTest() {
  const els = testEls();
  if (!els) return;
  els.mode.classList.remove('active');
  publishStagedCSV(null);
  fitTestRuffle();
  if (testPlayer) {
    els.mode.classList.add('warm');
    setTestVolume(0);
    bootTestMovie(true);
  } else {
    els.mode.classList.remove('warm');
  }
  resizeCanvas();
  draw();
}
