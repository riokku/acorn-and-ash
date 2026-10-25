import { kingsRoadAt, kingsRoadHeight } from './kings-road';
import { CROWNBREAKER_HOLD, kingsHoldGround } from './hollow-king';
import { highPlainsHeightAt } from './high-plains';
import { SKELETON_TOWN, townGroundHeight } from './skeleton-town';
/**
 * The ground the player walks on.
 */

import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../constants';
import { smoothstep } from '../math/vec3';
import { LAKE, lakeGroundHeight, lakeDepthAt, type Lake } from './lake';
import { mountainHeightAt } from './mountains';
import { STREAM, streamGroundHeight, nearStream, type Stream } from './stream';
import { fractalNoise2D } from './noise';
import { POND } from './clearing';
import { pondGroundHeight } from './pond';
import { forestReliefHeightAt, forestTrailHeightAt, forestTrailAt } from './forest-relief';

export interface Terrain {
  /** A label used in logs and save files. */
  readonly kind: string;
  /** Ground height in metres at a world position. */
  heightAt(x: number, z: number): number;
  /** Original ground for seeded scenery choices, so reshaping a hill never renumbers saved trees. */
  sceneryHeightAt?(x: number, z: number): number;
}

export function createFlatTerrain(height = 0): Terrain {
  return {
    kind: 'flat',
    heightAt: () => height,
  };
}

/**
 * The generated wilderness beyond the hand-built clearing.
 *
 * Ground stays flat through the clearing apart from the pond basin, rolls into
 * hills beyond that, and flattens again for the last stretch before the
 * invisible wall at the edge of the world - so neither the clearing nor the
 * boundary ever sit on a slope. Same seed, same hills, on the server and in
 * every browser: nothing about the shape of the ground travels over the wire.
 * Wooded terraces and graded contour trails give the hills resting shelves
 * and a walkable ascent into the mountain range.
 *
 * The mountain range stands in the far south-west (see mountains.ts), on top
 * of the hills.
 *
 * The lake sits in the north-east corner, and the ground is shaped round it:
 * a gentle bank, a sunken floor and a dome for each island (see lake.ts).
 */
export function createWildernessTerrain(seed: number, lake: Lake = LAKE): Terrain {
  return {
    kind: 'wilderness',
    heightAt: (x, z) => wildernessHeightAt(seed, x, z, lake),
    sceneryHeightAt: (x, z) => originalWildernessHeightAt(seed, x, z, lake),
  };
}

/**
 * How much weight the hills get at this distance from the centre: 0 to 1.
 *
 * `edgeDistance` is how far the spot is from the middle measured to the square
 * wall (the larger of |x| and |z|), which is what the ground flattens against;
 * it defaults to the plain distance.
 */
export function wildernessHillWeight(
  distanceFromCentre: number,
  edgeDistance: number = distanceFromCentre,
): number {
  const risingIn = smoothstep(
    distanceFromCentre,
    WILDERNESS.flatRadius,
    WILDERNESS.flatRadius + WILDERNESS.hillBlend,
  );
  const flattenOut =
    1 - smoothstep(edgeDistance, PLAYABLE_HALF_EXTENT - WILDERNESS.edgeFlat, PLAYABLE_HALF_EXTENT);
  return Math.min(risingIn, flattenOut);
}

export function wildernessHeightAt(
  seed: number,
  x: number,
  z: number,
  lake: Lake = LAKE,
  stream: Stream | null = STREAM,
): number {
  const hills = hillsHeightAt(seed, x, z) + mountainHeightAt(seed, x, z);
  const weight = wildernessHillWeight(Math.hypot(x, z), Math.max(Math.abs(x), Math.abs(z)));
  const relief = hills + (forestReliefHeightAt(seed, x, z, hills) - hills) * weight;
  const townLevel =
    Math.abs(x - SKELETON_TOWN.x) < 44 && Math.abs(z - SKELETON_TOWN.z) < 44
      ? hillsHeightAt(seed, SKELETON_TOWN.x, SKELETON_TOWN.z)
      : relief;
  const kingLevel =
    Math.abs(x - CROWNBREAKER_HOLD.x) < 42 && Math.abs(z - CROWNBREAKER_HOLD.z) < 42
      ? hillsHeightAt(seed, CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z)
      : relief;
  const settled = kingsHoldGround(x, z, townGroundHeight(x, z, relief, townLevel), kingLevel);
  const roadGround =
    kingsRoadAt(x, z) === null
      ? settled
      : kingsRoadHeight(
          x,
          z,
          settled,
          hillsHeightAt(seed, SKELETON_TOWN.x, SKELETON_TOWN.z),
          hillsHeightAt(seed, CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z),
        );
  const upland = highPlainsHeightAt(seed, x, z, roadGround);
  // Water retains final authority over beds and banks, including the pass approach.
  const ground = shapeWater(lake, stream, x, z, upland);
  if (forestTrailAt(x, z) === null) return ground;
  // Water keeps the final say at its banks; the trails stay on dry ground.
  if (lakeDepthAt(lake, x, z) > -8 || (stream !== null && nearStream(stream, x, z, 8)))
    return ground;
  const trail = forestTrailHeightAt(x, z, ground);
  const trailWeight = smoothstep(
    Math.hypot(x, z),
    WILDERNESS.flatRadius,
    WILDERNESS.flatRadius + 10,
  );
  return ground + (trail - ground) * trailWeight;
}

function originalWildernessHeightAt(seed: number, x: number, z: number, lake: Lake): number {
  return shapeWater(lake, STREAM, x, z, hillsHeightAt(seed, x, z) + mountainHeightAt(seed, x, z));
}

function shapeWater(
  lake: Lake,
  stream: Stream | null,
  x: number,
  z: number,
  hills: number,
): number {
  const ground = lakeGroundHeight(lake, x, z, hills);
  const riverGround = stream === null ? ground : streamGroundHeight(stream, lake, x, z, ground);
  return pondGroundHeight(POND, x, z, riverGround);
}

/** What the hills alone would make the ground, before the lake shapes it. */
function hillsHeightAt(seed: number, x: number, z: number): number {
  const weight = wildernessHillWeight(Math.hypot(x, z), Math.max(Math.abs(x), Math.abs(z)));
  if (weight <= 0) return 0;
  // Rescaled to roughly [-1, 1] so the ground rises and dips either side of
  // the clearing's own height rather than only ever rising.
  const noise = fractalNoise2D(seed, x * WILDERNESS.noiseScale, z * WILDERNESS.noiseScale) * 2 - 1;
  return noise * WILDERNESS.hillHeight * weight;
}
