// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Level rules shared by canvas edits and palette drops.

import {
  MAX_OBJECTS_PER_TILE, SONIC_TYPE, GOAL_TYPE, objectTileCostInTile, objectTiles,
  countObjectsInTile, type ObjectDef, type PlacedObject,
} from './format';
import { S, totalObjects, countPlacedTiles, updateDesc } from './state';
import { showDeleteError } from './popup';

export function rejectWithPopup(msg: string, show: (msg: string) => void) {
  updateDesc(msg);
  show(msg);
}

// every object needs a placed tile
function tileClearBlocked(bx: number, by: number): string | null {
  if (S.grid[by][bx] <= 0) return null;
  const total = totalObjects(), tiles = countPlacedTiles();
  if (total > tiles - 1) {
    return `This tile cannot be removed. There are ${total} objects for ${tiles} placed tiles. Delete an object first, then remove the tile.`;
  }
  return null;
}

export function rejectTileClear(bx: number, by: number): boolean {
  const why = tileClearBlocked(bx, by);
  if (why) rejectWithPopup(why, showDeleteError);
  return why !== null;
}

export function tileCrowdedReason(type: number, sub: number, x: number, y: number, except?: PlacedObject): string | null {
  for (const t of objectTiles(type, sub, x, y)) {
    const others = countObjectsInTile(S.objects, t.tc, t.tr, except);
    const added = objectTileCostInTile(type, sub, x, y, t.tc, t.tr);
    if (others + added <= MAX_OBJECTS_PER_TILE) continue;
    return added > 1
      ? `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects and this ring bunch needs room for ${added}. Try a tile with more room.`
      : `This tile is full. It already holds ${others} of ${MAX_OBJECTS_PER_TILE} objects. Try a tile with more room.`;
  }
  return null;
}

export function placementError(def: ObjectDef, x: number, y: number): string | null {
  if ((def.id === SONIC_TYPE || def.id === GOAL_TYPE) && S.objects.some(o => o.type === def.id)) {
    return `Your level already has ${def.id === SONIC_TYPE ? 'Sonic' : 'a Sign Post'}. Only one is allowed per level.`;
  }
  const total = totalObjects(), tiles = countPlacedTiles();
  if (total >= tiles) {
    return `The level is full. There are ${total} objects for ${tiles} placed tiles. Paint more tiles to place more objects.`;
  }
  return tileCrowdedReason(def.id, def.sub ?? 0, x, y);
}
