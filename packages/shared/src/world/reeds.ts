/**
 * Where reeds grow for the cutting around the lake (see decisions 0091 and
 * 0099).
 *
 * Most reeds at the lake are scenery. A few are *mature reeds*: taller and
 * golden, they stand out from the rest and are the ones that can be cut. They
 * are what rope is twisted from, and rope is what a rowboat is lashed together
 * with. A bed holds a few, gathered by hand like sticks and flowers; cut
 * clean, it is gone for about twenty minutes and comes back at a different
 * place along the shore.
 *
 * Built from the lake alone, so the first beds and every place a bed can
 * return to are the same in every world, and nothing about them needs to be
 * sent: the server only says where each bed is now and how many are left.
 */

import { REED_REGROW_MAX_SECONDS, REED_REGROW_MIN_SECONDS } from '../constants';
import { createRng, hashSeed } from '../rng';
import { basinDepthAt, LAKE, type Lake } from './lake';
import type { GatherSpot } from './clearing';

/**
 * The first reed patch's id. Patch ids are one byte on the wire: the clearing
 * numbers its own from 1, and the forest's berries and mushrooms start at 200.
 */
export const REED_PATCH_FIRST_ID = 100;
/** How far apart along the bank the patches stand, in metres - a few steps' walk of reeds, not a hedge of them. */
export const REED_PATCH_SPACING = 34;
/** How far into the shallows a patch stands: close enough to reach from the bank without wading. */
export const REED_PATCH_DEPTH = 0.45;

/** How finely the water's edge is walked while looking for places, in metres of bank. */
const EDGE_STEP = 0.5;
/** How far from exactly `REED_PATCH_DEPTH` still counts as being on the open bank, and not inside another circle of the lake. */
const EDGE_TOLERANCE = 0.02;

/** Every spot along the open bank, in a fixed order, at least `spacing` apart. */
function lakeEdgeSpots(lake: Lake, spacing: number): Array<{ x: number; z: number }> {
  const spots: Array<{ x: number; z: number }> = [];
  for (const circle of lake.basin) {
    const radius = circle.radius - REED_PATCH_DEPTH;
    const steps = Math.ceil((Math.PI * 2 * radius) / EDGE_STEP);
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      const x = circle.x + Math.cos(angle) * radius;
      const z = circle.z + Math.sin(angle) * radius;
      if (Math.abs(basinDepthAt(lake, x, z) - REED_PATCH_DEPTH) > EDGE_TOLERANCE) continue;
      if (spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spacing)) continue;
      spots.push({ x, z });
    }
  }
  return spots;
}

/**
 * The beds along a lake's mainland bank where a world starts, in a fixed
 * order: round each circle of the basin in turn, taking every spot that is on
 * the open edge of the lake (not where two circles run into each other, which
 * is deep water) and is at least `spacing` from every spot already taken.
 */
export function buildReedPatchSpots(lake: Lake, spacing = REED_PATCH_SPACING): GatherSpot[] {
  return lakeEdgeSpots(lake, spacing).map((spot, index) => ({
    id: REED_PATCH_FIRST_ID + index,
    x: spot.x,
    z: spot.z,
    item: 'reed',
  }));
}

/** The lake as built, with its reeds. */
export const REED_PATCHES: readonly GatherSpot[] = buildReedPatchSpots(LAKE);

/** Whether this patch is one of the lake's reeds, the mature ones that can be cut. */
export function isReedPatch(id: number): boolean {
  return id >= REED_PATCH_FIRST_ID && id < REED_PATCH_FIRST_ID + REED_PATCHES.length;
}

/** How closely the places a bed can return to are spread round the shore, in metres. */
export const REED_SHORE_SPACING = 6;
/**
 * Every place round the lake a bed of mature reeds can come back to: a close
 * run of spots on the open bank, so a bed can turn up almost anywhere along
 * the shore and not only where the world started with one.
 */
export const REED_SHORE_SPOTS: readonly { x: number; z: number }[] = lakeEdgeSpots(
  LAKE,
  REED_SHORE_SPACING,
);

/** How far a regrown bed keeps from another bed that still has reeds, in metres. */
export const REED_BED_SPACING = 14;
/** How far from the place it was cut a bed must come back, so it really is somewhere else. */
export const REED_MIN_MOVE = 10;

/**
 * How long a bed cut clean in this generation takes to come back, in whole
 * milliseconds: anywhere from `minSeconds` up to a bit over half as long again
 * (fifteen to twenty-five minutes by default). Whole milliseconds, so the
 * server and a world waking from storage agree on the exact moment.
 */
export function reedRegrowDelayMs(
  worldSeed: number,
  patchId: number,
  generation: number,
  minSeconds: number = REED_REGROW_MIN_SECONDS,
): number {
  const rng = createRng(hashSeed('reed', 'delay', worldSeed, patchId, generation));
  const maxSeconds = minSeconds * (REED_REGROW_MAX_SECONDS / REED_REGROW_MIN_SECONDS);
  return Math.round(rng.nextRange(minSeconds, maxSeconds) * 1000);
}

/** Whether a bed that was cut clean at `emptiedAtMs` is due back at `nowMs`. */
export function reedIsDue(
  worldSeed: number,
  patchId: number,
  generation: number,
  emptiedAtMs: number,
  nowMs: number,
  minSeconds: number = REED_REGROW_MIN_SECONDS,
): boolean {
  return nowMs >= emptiedAtMs + reedRegrowDelayMs(worldSeed, patchId, generation, minSeconds);
}

/**
 * Where this generation of a bed comes back: the first place round the shore
 * that `isClear` accepts, trying every place in a seeded order, or null if
 * none will do. `from` is where it was cut; a bed always moves at least
 * `REED_MIN_MOVE` away from that.
 */
export function reedRegrowSpot(
  worldSeed: number,
  patchId: number,
  generation: number,
  from: { x: number; z: number },
  isClear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const rng = createRng(hashSeed('reed', 'spot', worldSeed, patchId, generation));
  const order = REED_SHORE_SPOTS.map((_, index) => index);
  // A seeded shuffle, so every world has its own order but always the same one.
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (const index of order) {
    const spot = REED_SHORE_SPOTS[index]!;
    if (Math.hypot(spot.x - from.x, spot.z - from.z) < REED_MIN_MOVE) continue;
    if (isClear(spot.x, spot.z)) return spot;
  }
  return null;
}

/** Whether a place is one a bed can stand: where the world starts one, or anywhere on the shore. */
export function isReedSpot(x: number, z: number): boolean {
  const near = (spot: { x: number; z: number }): boolean =>
    Math.hypot(spot.x - x, spot.z - z) < 0.01;
  return REED_PATCHES.some(near) || REED_SHORE_SPOTS.some(near);
}
