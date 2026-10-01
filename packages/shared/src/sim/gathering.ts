/**
 * Gathering sticks and flowers by hand (see decision 0061).
 *
 * A patch holds only a few - somewhere between `GATHER_PATCH_MIN_COUNT` and
 * `GATHER_PATCH_MAX_COUNT` - and each gather takes one. Picked clean, it is
 * gone for a few minutes and then grows back somewhere else in the clearing,
 * with a fresh count.
 *
 * How many a patch holds, how long it takes to come back and where it tries
 * to grow all come from the world seed, the patch and how many times it has
 * grown back before, so the same world always plays out the same way. Where
 * it actually ends up also depends on what is standing in the clearing by
 * then, which only the server knows for sure, so the server sends where each
 * patch is rather than every browser working it out.
 *
 * Time is passed in rather than read, for the same reason trees do it (see
 * `regrowth.ts`): a world with nobody in it stops ticking, and a patch
 * picked clean before everybody left still has to be back when somebody
 * returns.
 */

import {
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  PATCH_REGROW_MIN_SECONDS,
  PATCH_REGROW_RADIUS,
  PICKUP_REACH,
} from '../constants';
import { createRng, hashSeed } from '../rng';
import type { ItemId } from '../data/items';
import type { Vec3 } from '../math/vec3';
import type { GatherSpot } from '../world/clearing';

/** A patch as it lies right now. */
export interface GatherPatch {
  /** Which patch this is, wherever it has moved to (see `GatherSpot`). */
  readonly id: number;
  readonly item: ItemId;
  x: number;
  z: number;
  /** How many are left to gather. Zero while it is picked clean and waiting to grow back. */
  remaining: number;
  /** How many times it has grown back. Picks its count, its wait and its next spot. */
  generation: number;
  /** When it was picked clean, in real milliseconds. Only means anything while `remaining` is zero. */
  emptiedAtMs: number;
}

/** What a browser is told about one patch: where it is and how many are left. */
export interface GatherPatchView {
  readonly id: number;
  readonly item: ItemId;
  readonly x: number;
  readonly z: number;
  /** Zero means picked clean: nothing to draw, nothing to gather. */
  readonly remaining: number;
}

/** How many tries a regrowing patch gets at finding a clear spot before it settles for its first one. */
const SPOT_ATTEMPTS = 48;

/** One patch's own generator for one generation, with its own label so no two rolls share a sequence. */
function rngFor(label: string, worldSeed: number, patchId: number, generation: number) {
  return createRng(hashSeed('patch', label, worldSeed, patchId, generation));
}

/** How many this generation of a patch holds: anywhere from the least to the most, both included. */
export function patchCount(worldSeed: number, patchId: number, generation: number): number {
  const rng = rngFor('count', worldSeed, patchId, generation);
  return GATHER_PATCH_MIN_COUNT + rng.nextInt(GATHER_PATCH_MAX_COUNT - GATHER_PATCH_MIN_COUNT + 1);
}

/**
 * How long a patch picked clean during this generation takes to grow back,
 * in whole milliseconds - somewhere between the shortest wait and twice it.
 * Whole milliseconds for the same reason `regrowDelayMs` uses them.
 */
export function patchRegrowDelayMs(
  worldSeed: number,
  patchId: number,
  generation: number,
  minSeconds: number = PATCH_REGROW_MIN_SECONDS,
): number {
  const rng = rngFor('delay', worldSeed, patchId, generation);
  return Math.round(rng.nextRange(minSeconds, minSeconds * 2) * 1000);
}

/** Whether a picked-clean patch is due back. A patch with any left is never "due". */
export function patchIsDue(
  worldSeed: number,
  patch: Readonly<GatherPatch>,
  nowMs: number,
  minSeconds: number = PATCH_REGROW_MIN_SECONDS,
): boolean {
  if (patch.remaining > 0) return false;
  return (
    nowMs >=
    patch.emptiedAtMs + patchRegrowDelayMs(worldSeed, patch.id, patch.generation, minSeconds)
  );
}

/**
 * Where this generation of a patch grows: the first of a seeded run of
 * spots across the open middle of the clearing that `isClear` accepts, or
 * null if none of them is.
 *
 * Spots are spread evenly over the disc rather than bunched in the middle,
 * so a patch is as likely to turn up out by the trees as near the spawn.
 */
export function patchRegrowSpot(
  worldSeed: number,
  patchId: number,
  generation: number,
  isClear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const rng = rngFor('spot', worldSeed, patchId, generation);
  for (let attempt = 0; attempt < SPOT_ATTEMPTS; attempt++) {
    const angle = rng.nextRange(0, Math.PI * 2);
    const radius = PATCH_REGROW_RADIUS * Math.sqrt(rng.nextFloat());
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (isClear(x, z)) return { x, z };
  }
  return null;
}

/** A patch as the clearing first lays it out, with however many generation zero holds. */
export function freshPatch(worldSeed: number, spot: GatherSpot): GatherPatch {
  return {
    id: spot.id,
    item: spot.item,
    x: spot.x,
    z: spot.z,
    remaining: patchCount(worldSeed, spot.id, 0),
    generation: 0,
    emptiedAtMs: 0,
  };
}

/** What a browser is told about a patch. */
export function patchView(patch: Readonly<GatherPatch>): GatherPatchView {
  return { id: patch.id, item: patch.item, x: patch.x, z: patch.z, remaining: patch.remaining };
}

/**
 * The nearest patch this player could gather from right now, or null.
 *
 * A patch picked clean is not there at all as far as reach goes, so a
 * player standing between an empty patch and a full one reaches the full one.
 */
export function gatherSpotInReach<T extends { x: number; z: number; remaining: number }>(
  position: Readonly<Vec3>,
  patches: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const patch of patches) {
    if (patch.remaining <= 0) continue;
    const dx = patch.x - position.x;
    const dz = patch.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = patch;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
