/**
 * Where reeds grow for the cutting, at every body of water (see decisions 0091,
 * 0099 and 0101).
 *
 * Most reeds at the water are scenery. A few are *mature reeds*: taller and
 * golden, they stand out from the rest and are the ones that can be cut. They
 * are what rope is twisted from, and rope is what a rowboat is lashed together
 * with. A bed holds a few, gathered by hand like sticks and flowers; cut
 * clean, it is gone for fifteen to twenty-five minutes and comes back at a
 * different place along the shore of the same water, so every pond and lake
 * always has some.
 *
 * Built from the waters alone, so the first beds and every place a bed can
 * return to are the same in every world, and nothing about them needs to be
 * sent: the server only says where each bed is now and how many are left.
 */

import {
  PATCH_SPACING,
  REED_REGROW_MAX_SECONDS,
  REED_REGROW_MIN_SECONDS,
  SPAWN_POSITION,
} from '../constants';
import { createRng, hashSeed } from '../rng';
import {
  AXE_STUMP,
  BAG_SPOT,
  FLOWER_PATCHES,
  POND,
  ROD_SPOT,
  STICK_PATCHES,
  type GatherSpot,
} from './clearing';
import { LAKE } from './lake';
import type { WaterCircle } from './water';

/**
 * The first reed patch's id. Patch ids are one byte on the wire: the clearing
 * numbers its own from 1, and the forest's berries and mushrooms start at 200.
 */
export const REED_PATCH_FIRST_ID = 100;
/** How far into the shallows a patch stands: close enough to reach from the bank without wading. */
export const REED_PATCH_DEPTH = 0.45;

/** How finely the water's edge is walked while looking for places, in metres of bank. */
const EDGE_STEP = 0.5;
/** How far from exactly `REED_PATCH_DEPTH` still counts as being on the open bank, and not inside another circle of the water. */
const EDGE_TOLERANCE = 0.02;

/** A body of water that reeds grow beside, and how its beds are laid out. */
export interface ReedWater {
  readonly name: 'lake' | 'pond';
  /** The circles that make the water's outline, islands included. */
  readonly circles: readonly WaterCircle[];
  /** How far apart the beds a world starts with stand along the bank, in metres. */
  readonly startSpacing: number;
  /** How closely the places a bed can return to are spread round the shore, in metres. */
  readonly shoreSpacing: number;
  /** How far a regrown bed keeps from another bed of this water that still has reeds, in metres. */
  readonly bedSpacing: number;
  /** How far from the place it was cut a bed must come back, so it really is somewhere else. */
  readonly minMove: number;
  /** Places a bed keeps clear of, so one press of the button never means two things. */
  readonly keepClearOf: readonly { x: number; z: number }[];
}

/**
 * Every body of water with reeds, lake first: the lake's beds keep the ids
 * they have always had, so a world saved before the pond had any loads as it
 * was. The lake is wide, so its beds stand far apart; the pond is small, so
 * its beds are closer, and it keeps clear of the things the clearing already
 * lays out round it - the rod on its bank, the flowers, the first sticks.
 */
export const REED_WATERS: readonly ReedWater[] = [
  {
    name: 'lake',
    circles: LAKE.basin,
    startSpacing: 34,
    shoreSpacing: 6,
    bedSpacing: 14,
    minMove: 10,
    keepClearOf: [],
  },
  {
    name: 'pond',
    circles: POND,
    startSpacing: 7,
    shoreSpacing: 1.5,
    bedSpacing: 6,
    minMove: 4,
    keepClearOf: [
      SPAWN_POSITION,
      AXE_STUMP,
      BAG_SPOT,
      ROD_SPOT,
      ...STICK_PATCHES,
      ...FLOWER_PATCHES,
    ],
  },
];

/** How far inside a water's outline this spot is, in metres: negative on dry land beyond it. */
function outlineDepthAt(circles: readonly WaterCircle[], x: number, z: number): number {
  let deepest = -Infinity;
  for (const circle of circles) {
    deepest = Math.max(deepest, circle.radius - Math.hypot(x - circle.x, z - circle.z));
  }
  return deepest;
}

/**
 * Every spot along the open bank of a water, in a fixed order, at least
 * `spacing` apart and clear of everything the water keeps clear of.
 */
function edgeSpots(water: ReedWater, spacing: number): Array<{ x: number; z: number }> {
  const spots: Array<{ x: number; z: number }> = [];
  for (const circle of water.circles) {
    const radius = circle.radius - REED_PATCH_DEPTH;
    const steps = Math.ceil((Math.PI * 2 * radius) / EDGE_STEP);
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      const x = circle.x + Math.cos(angle) * radius;
      const z = circle.z + Math.sin(angle) * radius;
      if (Math.abs(outlineDepthAt(water.circles, x, z) - REED_PATCH_DEPTH) > EDGE_TOLERANCE) {
        continue;
      }
      if (water.keepClearOf.some((place) => Math.hypot(place.x - x, place.z - z) < PATCH_SPACING)) {
        continue;
      }
      if (spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spacing)) continue;
      spots.push({ x, z });
    }
  }
  return spots;
}

/**
 * The beds where a world starts, water by water in `REED_WATERS` order: round
 * each circle of the outline in turn, taking every spot that is on the open
 * edge (not where two circles run into each other, which is deep water) and
 * is at least `startSpacing` from every spot already taken.
 */
export function buildReedPatchSpots(waters: readonly ReedWater[] = REED_WATERS): GatherSpot[] {
  const beds: GatherSpot[] = [];
  for (const water of waters) {
    for (const spot of edgeSpots(water, water.startSpacing)) {
      beds.push({ id: REED_PATCH_FIRST_ID + beds.length, x: spot.x, z: spot.z, item: 'reed' });
    }
  }
  return beds;
}

/** Every bed a world starts with, at every water. */
export const REED_PATCHES: readonly GatherSpot[] = buildReedPatchSpots();

/** Which water each of `REED_PATCHES` stands at, in the same order. */
const REED_PATCH_WATERS: readonly ReedWater[] = REED_WATERS.flatMap((water) =>
  edgeSpots(water, water.startSpacing).map(() => water),
);

/** Whether this patch is one of the reeds, the mature ones that can be cut. */
export function isReedPatch(id: number): boolean {
  return id >= REED_PATCH_FIRST_ID && id < REED_PATCH_FIRST_ID + REED_PATCHES.length;
}

/** The water this bed belongs to: it always comes back at the same one. Null for anything that is not a bed. */
export function reedWaterOf(patchId: number): ReedWater | null {
  return REED_PATCH_WATERS[patchId - REED_PATCH_FIRST_ID] ?? null;
}

/**
 * Every place round each water a bed of mature reeds can come back to: a
 * close run of spots on the open bank, so a bed can turn up almost anywhere
 * along the shore and not only where the world started with one.
 */
const SHORE_SPOTS_BY_WATER: ReadonlyMap<ReedWater, readonly { x: number; z: number }[]> = new Map(
  REED_WATERS.map((water) => [water, edgeSpots(water, water.shoreSpacing)]),
);

/** The places a bed of this water can come back to. */
export function reedShoreSpots(water: ReedWater): readonly { x: number; z: number }[] {
  return SHORE_SPOTS_BY_WATER.get(water) ?? [];
}

/** The same places for every water at once. */
export const REED_SHORE_SPOTS: readonly { x: number; z: number }[] = REED_WATERS.flatMap((water) =>
  reedShoreSpots(water),
);

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
 * of the water it belongs to that `isClear` accepts, trying every place in a
 * seeded order, or null if none will do (or if this is not a bed at all).
 * `from` is where it was cut; a bed always moves at least that water's
 * `minMove` away from it.
 */
export function reedRegrowSpot(
  worldSeed: number,
  patchId: number,
  generation: number,
  from: { x: number; z: number },
  isClear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const water = reedWaterOf(patchId);
  if (water === null) return null;
  const spots = reedShoreSpots(water);
  const rng = createRng(hashSeed('reed', 'spot', worldSeed, patchId, generation));
  const order = spots.map((_, index) => index);
  // A seeded shuffle, so every world has its own order but always the same one.
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (const index of order) {
    const spot = spots[index]!;
    if (Math.hypot(spot.x - from.x, spot.z - from.z) < water.minMove) continue;
    if (isClear(spot.x, spot.z)) return spot;
  }
  return null;
}

/** How far a regrown bed keeps from another live bed of the same water, in metres. */
export function reedBedSpacing(patchId: number): number {
  return reedWaterOf(patchId)?.bedSpacing ?? 0;
}

/** Whether a place is one a bed can stand: where the world starts one, or anywhere on a shore. */
export function isReedSpot(x: number, z: number): boolean {
  const near = (spot: { x: number; z: number }): boolean =>
    Math.hypot(spot.x - x, spot.z - z) < 0.01;
  return REED_PATCHES.some(near) || REED_SHORE_SPOTS.some(near);
}

/** Whether this bed could stand here: a place on the shore of the water it belongs to. */
export function isReedSpotFor(patchId: number, x: number, z: number): boolean {
  const water = reedWaterOf(patchId);
  if (water === null) return false;
  const near = (spot: { x: number; z: number }): boolean =>
    Math.hypot(spot.x - x, spot.z - z) < 0.01;
  return (
    reedShoreSpots(water).some(near) || REED_PATCHES.some((bed) => bed.id === patchId && near(bed))
  );
}
