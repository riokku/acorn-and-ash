/**
 * Where stone and iron ore lie on the mountain (decision 0114, step 3).
 *
 * Loose stone and ore chunks lie about the slopes, and are picked up by hand
 * like sticks and berries - no new tool. Stone is scattered over the lower
 * slopes and the foot; ore lies higher, up in the bare rock above the pines,
 * so getting it means a climb.
 *
 * Built from the seed alone, so the first spots are the same on the server
 * and in every browser, and the same world always has its rocks in the same
 * places. Only where each pile is *now* and how many are left travel over
 * the wire, as with every other patch.
 */

import { MOUNTAINS } from '../constants';
import { createRng, hashSeed } from '../rng';
import type { Terrain } from './terrain';
import { mountainWeight } from './mountains';
import { nearStream, STREAM } from './stream';
import type { GatherSpot } from './clearing';

/**
 * The first mountain pile's id. Patch ids are one byte on the wire: the
 * clearing numbers its own from 1, reeds start at 100, the forest's berries and
 * mushrooms take 200-207 and the mountain takes 210-239.
 */
export const MOUNTAIN_PATCH_FIRST_ID = 210;
export const MOUNTAIN_STONE_PILES = 16;
export const MOUNTAIN_ORE_PILES = 10;
/** The last id the mountain may use. */
export const MOUNTAIN_PATCH_LAST_ID = MOUNTAIN_PATCH_FIRST_ID + 29;

/** Stone lies from the foot up to this far into the range; ore only above `ORE_MIN_HEIGHT`. */
const STONE_MIN_WEIGHT = 0.25;
const STONE_MAX_HEIGHT = MOUNTAINS.treeLine - 4;
const ORE_MIN_HEIGHT = MOUNTAINS.treeLine - 8;
const ORE_MAX_HEIGHT = MOUNTAINS.snowLine - 2;
/** No piles on ground steeper than this, so every one can be reached on foot. */
const MAX_PILE_GRADIENT = 0.6;
/** Piles keep at least this far apart, in metres. */
const PILE_SPACING = 14;
const ATTEMPTS = 4000;

export function isMountainPatch(id: number): boolean {
  return id >= MOUNTAIN_PATCH_FIRST_ID && id <= MOUNTAIN_PATCH_LAST_ID;
}

function gradientAround(terrain: Terrain, x: number, z: number): number {
  const here = terrain.heightAt(x, z);
  let steepest = 0;
  for (const [dx, dz] of [
    [1.5, 0],
    [-1.5, 0],
    [0, 1.5],
    [0, -1.5],
  ] as const) {
    steepest = Math.max(steepest, Math.abs(terrain.heightAt(x + dx, z + dz) - here) / 1.5);
  }
  return steepest;
}

/**
 * Every pile the mountain starts with: stone first, then ore, with fixed ids.
 * `isClear` lets the caller keep piles off trees and other solid things.
 */
export function buildMountainRockSpots(
  seed: number,
  terrain: Terrain,
  isClear: (x: number, z: number) => boolean = () => true,
): GatherSpot[] {
  const rng = createRng(hashSeed(seed, 'mountain-rocks'));
  const spots: GatherSpot[] = [];
  const wanted = [
    { item: 'stone' as const, count: MOUNTAIN_STONE_PILES },
    { item: 'ironOre' as const, count: MOUNTAIN_ORE_PILES },
  ];
  const { ridgeStart: a, ridgeEnd: b } = MOUNTAINS;
  for (const { item, count } of wanted) {
    let placed = 0;
    for (let attempt = 0; attempt < ATTEMPTS && placed < count; attempt++) {
      // Anywhere in a box round the ridge; the checks below keep it on the range.
      const t = rng.nextRange(0, 1);
      const x = a.x + (b.x - a.x) * t + rng.nextRange(-MOUNTAINS.footRadius, MOUNTAINS.footRadius);
      const z = a.z + (b.z - a.z) * t + rng.nextRange(-MOUNTAINS.footRadius, MOUNTAINS.footRadius);
      if (mountainWeight(x, z) < STONE_MIN_WEIGHT) continue;
      const height = terrain.heightAt(x, z);
      if (
        item === 'stone'
          ? height > STONE_MAX_HEIGHT
          : height < ORE_MIN_HEIGHT || height > ORE_MAX_HEIGHT
      )
        continue;
      if (gradientAround(terrain, x, z) > MAX_PILE_GRADIENT) continue;
      if (nearStream(STREAM, x, z, 4)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < PILE_SPACING)) continue;
      if (!isClear(x, z)) continue;
      spots.push({ id: MOUNTAIN_PATCH_FIRST_ID + spots.length, x, z, item });
      placed++;
    }
  }
  return spots;
}
