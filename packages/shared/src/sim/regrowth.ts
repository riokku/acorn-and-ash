/**
 * Trees growing back.
 *
 * Two things here have to be worked out the same way by the server and by every
 * browser, without either sending them: how long a felled tree takes to return,
 * and how big it is when it does. Both come from the world seed, the tree's id
 * and how many times that spot has grown back before, so the only thing that
 * ever travels is that count.
 *
 * Time is passed in rather than read. A world with nobody in it stops ticking
 * entirely, so regrowth cannot be counted in ticks: a tree felled at midnight
 * has to be back when somebody logs in at one, having counted nothing in
 * between. The caller supplies real time; this file stays deterministic.
 */

import {
  REGROW_CLEARANCE,
  REGROW_MIN_SECONDS,
  REGROWN_SCALE_MAX,
  REGROWN_SCALE_MIN,
} from '../constants';
import { createRng, hashSeed } from '../rng';
import type { Vec3 } from '../math/vec3';
import type { PlacedProp } from '../world/clearing';

/**
 * A tree's own generator: the same seed, tree and generation always give the
 * same answers, on the server and in every browser.
 */
function rngFor(worldSeed: number, treeId: number, generation: number) {
  return createRng(hashSeed('regrow', worldSeed, treeId, generation));
}

/**
 * How long this felling takes to come back, in whole milliseconds.
 *
 * Somewhere between the shortest wait and twice it. Whole milliseconds, so that
 * adding the delay to a timestamp stays exact: a fractional delay on top of a
 * number the size of a real clock loses its own low bits.
 *
 * The shortest wait can be turned down, which is how a preview or a local run
 * shows a tree coming back in seconds instead of half an hour.
 */
export function regrowDelayMs(
  worldSeed: number,
  treeId: number,
  generation: number,
  minSeconds: number = REGROW_MIN_SECONDS,
): number {
  const rng = rngFor(worldSeed, treeId, generation);
  return Math.round(rng.nextRange(minSeconds, minSeconds * 2) * 1000);
}

/**
 * How big the tree is when it comes back.
 *
 * Generation zero is the tree the clearing was built with, so its size is
 * whatever the clearing gave it; every generation after that is fresh.
 */
export function regrownScale(
  worldSeed: number,
  treeId: number,
  generation: number,
  originalScale: number,
): number {
  if (generation <= 0) return originalScale;
  const rng = rngFor(worldSeed, treeId, generation);
  // Burned once so the size does not track the delay drawn from the same seed.
  rng.nextFloat();
  return rng.nextRange(REGROWN_SCALE_MIN, REGROWN_SCALE_MAX);
}

/** When this felling is due back. */
export function regrowDueAtMs(
  worldSeed: number,
  treeId: number,
  generation: number,
  felledAtMs: number,
  minSeconds: number = REGROW_MIN_SECONDS,
): number {
  return felledAtMs + regrowDelayMs(worldSeed, treeId, generation, minSeconds);
}

/**
 * Is anybody standing where this tree wants to be?
 *
 * A tree appearing around somebody would be a nasty surprise, so a due tree
 * waits for the spot to clear rather than growing through them.
 */
export function spotIsClear(
  x: number,
  z: number,
  footprintRadius: number,
  players: Iterable<Readonly<Vec3>>,
): boolean {
  const keepOut = footprintRadius + REGROW_CLEARANCE;
  const keepOutSquared = keepOut * keepOut;
  for (const player of players) {
    const dx = player.x - x;
    const dz = player.z - z;
    if (dx * dx + dz * dz < keepOutSquared) return false;
  }
  return true;
}

/**
 * The tree standing in this spot now.
 *
 * Generation zero is the one the clearing was built with. Every generation
 * after that is a new tree of its own size, which both ends work out from the
 * seed rather than being told.
 */
export function treeAtGeneration(
  worldSeed: number,
  tree: PlacedProp,
  generation: number,
): PlacedProp {
  if (generation <= 0) return tree;
  return { ...tree, scale: regrownScale(worldSeed, tree.id, generation, tree.scale) };
}
