/**
 * Where reeds grow for the cutting along the lake's bank (see decision 0091).
 *
 * Reeds are what rope is twisted from, and rope is what a rowboat is lashed
 * together with. They are gathered by hand like sticks and flowers - a patch
 * holds a few, picked clean it is bare for a few minutes - but a reed is
 * rooted, so a patch grows back where it stood instead of somewhere new.
 *
 * Built from the lake alone, so the spots are the same in every world and
 * nothing about them needs to be sent: the server only says how many are left.
 */

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

/**
 * The patches along a lake's mainland bank, in a fixed order: round each
 * circle of the basin in turn, taking every spot that is on the open edge of
 * the lake (not where two circles run into each other, which is deep water)
 * and is at least `spacing` from every spot already taken.
 */
export function buildReedPatchSpots(lake: Lake, spacing = REED_PATCH_SPACING): GatherSpot[] {
  const spots: GatherSpot[] = [];
  for (const circle of lake.basin) {
    const radius = circle.radius - REED_PATCH_DEPTH;
    const steps = Math.ceil((Math.PI * 2 * radius) / EDGE_STEP);
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      const x = circle.x + Math.cos(angle) * radius;
      const z = circle.z + Math.sin(angle) * radius;
      if (Math.abs(basinDepthAt(lake, x, z) - REED_PATCH_DEPTH) > EDGE_TOLERANCE) continue;
      if (spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spacing)) continue;
      spots.push({ id: REED_PATCH_FIRST_ID + spots.length, x, z, item: 'reed' });
    }
  }
  return spots;
}

/** The lake as built, with its reeds. */
export const REED_PATCHES: readonly GatherSpot[] = buildReedPatchSpots(LAKE);

/** Whether this patch is one of the lake's reeds, which grow back where they stand. */
export function isReedPatch(id: number): boolean {
  return id >= REED_PATCH_FIRST_ID && id < REED_PATCH_FIRST_ID + REED_PATCHES.length;
}
