/**
 * The generated wilderness: trees and rocks scattered beyond the hand-built
 * clearing's own ring of trees.
 *
 * Built from the seed alone, the same way the clearing is, so the client and
 * the server always agree without anything about it going over the wire. This
 * is only how the forest starts out: its trees can be chopped down and grow
 * back like the clearing's (see decision 0098), and the server remembers
 * which ones are down. Rocks never change.
 *
 * Every prop is numbered from `WILDERNESS_PROP_FIRST_ID`, so a tree's number
 * means one tree across the clearing and the wilderness together.
 */

import { WOODLAND_ENCOUNTERS } from '../data/tracking';
import { forestTreeScale } from './tree-stature';
import {
  MOUNTAINS,
  PLAYABLE_HALF_EXTENT,
  WILDERNESS,
  WILDERNESS_PROP_FIRST_ID,
} from '../constants';
import { hashSeed, createRng } from '../rng';
import { lerp, smoothstep } from '../math/vec3';
import type { PropKindId } from '../data/props';
import type { Collider } from './colliders';
import { colliderForProp, type PlacedProp } from './clearing';
import { wildernessHillWeight, type Terrain } from './terrain';
import { fractalNoise2D } from './noise';
import { buildIslandProps } from './islands';
import { mountainWeight } from './mountains';
import { basinDepthAt, LAKE, LAKE_PROP_CLEARANCE, type Lake } from './lake';
import { nearStream, STREAM, STREAM_PROP_CLEARANCE, type Stream } from './stream';

const TREE_KINDS: readonly PropKindId[] = ['pine', 'birch', 'oak'];
const ROCK_KINDS: readonly PropKindId[] = ['boulder', 'mossyRock'];
/** Roughly one rock for every seven trees. */
const ROCK_CHANCE = 0.12;
/** Up on the mountain rocks take over: this is the share of spots that turn to rock at the tree line. */
const HIGH_ROCK_CHANCE = 0.6;
/** Trees thin out from here up to the tree line, and only pines grow in the thin air. */
const TREE_THINNING_START = 16;
const HIGH_PINE_HEIGHT = 14;
/** The steepest ground a tree or rock is set on, rise over run, measured over a few metres. */
const PROP_MAX_GRADIENT = 0.6;
const PROP_SLOPE_PROBE = 1.5;

/** The steepest rise over run in any direction a few metres either side of a spot. */
function steepnessAt(terrain: Terrain, x: number, z: number): number {
  const here = terrain.heightAt(x, z);
  const rises = [
    terrain.heightAt(x + PROP_SLOPE_PROBE, z),
    terrain.heightAt(x - PROP_SLOPE_PROBE, z),
    terrain.heightAt(x, z + PROP_SLOPE_PROBE),
    terrain.heightAt(x, z - PROP_SLOPE_PROBE),
  ].map((height) => Math.abs(height - here) / PROP_SLOPE_PROBE);
  return Math.max(...rises);
}
/** Well clear of the octave offsets `fractalNoise2D` uses internally, so the noise that decides where a glade sits never lines up with the noise that decides how tall the ground is there. */
const DENSITY_SEED_OFFSET = 7919;

/** Trunks and boulders have some width, so they keep this much further back from the water, in metres. */
const PROP_STREAM_MARGIN = 0.9;

export interface Wilderness {
  readonly props: readonly PlacedProp[];
  /** Each prop's collider, in the same order as `props`. */
  readonly colliders: readonly Collider[];
  /**
   * Where each prop sits in `props` and `colliders`, by its number. A felled
   * tree swaps its trunk for a stump by finding its collider this way.
   */
  readonly indexById: ReadonlyMap<number, number>;
  /** Original scenery keeps previously discovered encounter sites stable. */
  readonly siteColliders: readonly Collider[];
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
 *
 * Nothing grows in the lake or right at its edge, and each of its islands gets
 * a few trees and rocks of its own, numbered after all the others so no
 * existing tree changes its number.
 */
export function buildWilderness(
  seed: number,
  terrain: Terrain,
  lake: Lake = LAKE,
  stream: Stream = STREAM,
): Wilderness {
  const props: PlacedProp[] = [];
  // The scatter fills the square of the playable world, plus a margin.
  const outerExtent = PLAYABLE_HALF_EXTENT + WILDERNESS.scatterMargin;
  const steps = Math.floor(outerExtent / WILDERNESS.cellSize);
  let nextId = WILDERNESS_PROP_FIRST_ID;

  for (let ix = -steps; ix <= steps; ix++) {
    for (let iz = -steps; iz <= steps; iz++) {
      const gx = ix * WILDERNESS.cellSize;
      const gz = iz * WILDERNESS.cellSize;

      // Cheap rejection before any hashing: jitter can only move a candidate by
      // `jitter` metres, so a cell centre well outside the ring cannot land
      // inside it either way.
      const roughDistance = Math.hypot(gx, gz);
      if (roughDistance < WILDERNESS.flatRadius - WILDERNESS.jitter) continue;

      const cellRng = createRng(hashSeed(seed, 'wilderness', ix, iz));
      const x = gx + cellRng.nextRange(-WILDERNESS.jitter, WILDERNESS.jitter);
      const z = gz + cellRng.nextRange(-WILDERNESS.jitter, WILDERNESS.jitter);
      const distance = Math.hypot(x, z);
      if (distance < WILDERNESS.flatRadius) continue;
      const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
      if (edgeDistance > outerExtent) continue;

      const patchiness = fractalNoise2D(
        seed + DENSITY_SEED_OFFSET,
        x * WILDERNESS.densityNoiseScale,
        z * WILDERNESS.densityNoiseScale,
      );
      // Thin near the clearing's own tree line, full strength through most of
      // the wilderness: the same taper the hills use, so the forest thickens
      // roughly where the ground starts to roll.
      const easeIn = lerp(0.35, 1, wildernessHillWeight(distance, edgeDistance));
      const density = lerp(WILDERNESS.densityMin, WILDERNESS.densityMax, patchiness) * easeIn;
      if (cellRng.nextFloat() > density) continue;

      // Up the mountain the trees thin out and give way to bare rock.
      const y = terrain.heightAt(x, z);
      // Nothing is set on a steep face: it would sink into the slope on one
      // side and hang in the air on the other.
      if (mountainWeight(x, z) > 0 && steepnessAt(terrain, x, z) > PROP_MAX_GRADIENT) continue;
      const treeShare = 1 - smoothstep(y, TREE_THINNING_START, MOUNTAINS.treeLine);
      const rockChance = lerp(ROCK_CHANCE, HIGH_ROCK_CHANCE, 1 - treeShare);
      const isRock = cellRng.nextFloat() < rockChance;
      if (!isRock && treeShare < 1 && cellRng.nextFloat() > treeShare) continue;
      const kind = cellRng.pick(
        isRock ? ROCK_KINDS : y > HIGH_PINE_HEIGHT ? ['pine' as const] : TREE_KINDS,
      );

      props.push({
        id: nextId++,
        kind,
        x,
        z,
        y,
        rotationY: cellRng.nextRange(0, Math.PI * 2),
        // An independent stream changes stature without reshuffling any seeded positions.
        scale: isRock
          ? cellRng.nextRange(0.75, 1.35)
          : forestTreeScale(seed, x, z, cellRng.nextRange(0.75, 1.35)),
      });
    }
  }

  const kept = props.filter(
    (prop) =>
      basinDepthAt(lake, prop.x, prop.z) <= -LAKE_PROP_CLEARANCE &&
      !nearStream(stream, prop.x, prop.z, STREAM_PROP_CLEARANCE + PROP_STREAM_MARGIN) &&
      !WOODLAND_ENCOUNTERS.some(
        (site) => Math.hypot(prop.x - site.x, prop.z - site.z) < site.radius + 2,
      ),
  );
  const onIslands = buildIslandProps(seed, lake, terrain, nextId);
  const standing = [...kept, ...onIslands];
  return {
    props: standing,
    colliders: standing.map(colliderForProp),
    indexById: new Map(standing.map((prop, index) => [prop.id, index])),
    siteColliders: props.map(colliderForProp),
  };
}
