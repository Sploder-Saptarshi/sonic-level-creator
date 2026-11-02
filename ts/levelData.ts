import { encodeBin, encodeAct, toCSV, SONIC_TYPE, GOAL_TYPE } from './format';
import { S, updateDesc } from './state';

function countEssentials(): { sonics: number; goals: number } {
  return {
    sonics: S.objects.filter(o => o.type === SONIC_TYPE).length,
    goals: S.objects.filter(o => o.type === GOAL_TYPE).length,
  };
}

export function levelValid(): boolean {
  const { sonics, goals } = countEssentials();
  return sonics === 1 && goals === 1;
}

function levelProblems(): string[] {
  const { sonics, goals } = countEssentials();
  const out: string[] = [];
  if (sonics === 0 && goals === 0) {
    out.push('Your level has no start and no finish. Open the Essentials tab and place Sonic and a Sign Post.');
  } else {
    if (sonics === 0) out.push('Your level has no start. Open the Essentials tab and place Sonic.');
    if (goals === 0) out.push('Your level has no finish. Open the Essentials tab and place a Sign Post.');
  }
  if (sonics > 1) out.push('Your level has more than one Sonic. Keep just one Sonic so the game knows where to start.');
  if (goals > 1) out.push('Your level has more than one Sign Post. Keep just one so the game knows where the level ends.');
  return out;
}

export function ensureValid(showError: (msg: string) => void): boolean {
  if (levelValid()) return true;
  const why = levelProblems().join(' ');
  updateDesc(why);
  showError(why);
  return false;
}

export function levelCSV(): string {
  return toCSV(encodeBin(S.grid), encodeAct(S.objects));
}
