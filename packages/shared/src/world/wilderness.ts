/**
 * The generated wilderness: trees and rocks scattered beyond the hand-built
 * clearing's own ring of trees.
 *
 * Built from the seed alone, the same way the clearing is, so the client and
 * the server always agree without anything about it going over the wire. None
 * of it is ever chopped or picked up, so unlike the clearing's trees it never
 * changes once the world is built - there is nothing here for a save to
 * remember.
 */

import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../constants';
import { hashSeed, createRng } from '../rng';
import { lerp } from '../math/vec3';
import type { PropKindId } from '../data/props';
import type { Collider } from './colliders';
import { colliderForProp, type PlacedProp } from './clearing';
import { wildernessHillWeight, type Terrain } from './terrain';
import { fractalNoise2D } from './noise';

const TREE_KINDS: readonly PropKindId[] = ['pine', 'birch', 'oak'];
const ROCK_KINDS: readonly PropKindId[] = ['boulder', 'mossyRock'];
/** Roughly one rock for every seven trees. */
const ROCK_CHANCE = 0.12;
/** Well clear of the octave offsets `fractalNoise2D` uses internally, so the noise that decides where a glade sits never lines up with the noise that decides how tall the ground is there. */
const DENSITY_SEED_OFFSET = 7919;

export interface Wilderness {
  readonly props: readonly PlacedProp[];
  readonly colliders: readonly Collider[];
}

/**
 * Scatter trees and rocks across the wilderness.
 *
 * A grid of candidate spots, each jittered so it does not read as a grid, and
 * each kept or skipped by a second, coarser noise field so the forest comes in
 * patches with glades between them rather than an even, wall-to-wall wood.
 * Density also eases up over the same distance the ground eases into hills, so
 * the wilderness thickens as the clearing falls behind rather than starting at
 * full density the moment the tree line ends.
 */
export function buildWilderness(seed: number, terrain: Terrain): Wilderness {
  const props: PlacedProp[] = [];
  const outerRadius = PLAYABLE_HALF_EXTENT + WILDERNESS.scatterMargin;
  const steps = Math.floor(outerRadius / WILDERNESS.cellSize);
  let nextId = 1;

  for (let ix = -steps; ix <= steps; ix++) {
    for (let iz = -steps; iz <= steps; iz++) {
      const gx = ix * WILDERNESS.cellSize;
      const gz = iz * WILDERNESS.cellSize;

      // Cheap rejection before any hashing: jitter can only move a candidate by
      // `jitter` metres, so a cell centre well outside the ring cannot land
      // inside it either way.
      const roughDistance = Math.hypot(gx, gz);
      if (roughDistance < WILDERNESS.flatRadius - WILDERNESS.jitter) continue;
      if (roughDistance > outerRadius + WILDERNESS.jitter) continue;

      const cellRng = createRng(hashSeed(seed, 'wilderness', ix, iz));
      const x = gx + cellRng.nextRange(-WILDERNESS.jitter, WILDERNESS.jitter);
      const z = gz + cellRng.nextRange(-WILDERNESS.jitter, WILDERNESS.jitter);
      const distance = Math.hypot(x, z);
      if (distance < WILDERNESS.flatRadius || distance > outerRadius) continue;

      const patchiness = fractalNoise2D(
        seed + DENSITY_SEED_OFFSET,
        x * WILDERNESS.densityNoiseScale,
        z * WILDERNESS.densityNoiseScale,
      );
      // Thin near the clearing's own tree line, full strength through most of
      // the wilderness: the same taper the hills use, so the forest thickens
      // roughly where the ground starts to roll.
      const easeIn = lerp(0.35, 1, wildernessHillWeight(distance));
      const density = lerp(WILDERNESS.densityMin, WILDERNESS.densityMax, patchiness) * easeIn;
      if (cellRng.nextFloat() > density) continue;

      const isRock = cellRng.nextFloat() < ROCK_CHANCE;
      const kind = cellRng.pick(isRock ? ROCK_KINDS : TREE_KINDS);

      props.push({
        id: nextId++,
        kind,
        x,
        z,
        y: terrain.heightAt(x, z),
        rotationY: cellRng.nextRange(0, Math.PI * 2),
        scale: cellRng.nextRange(0.75, 1.35),
      });
    }
  }

  return { props, colliders: props.map(colliderForProp) };
}
