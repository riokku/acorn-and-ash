/**
 * The ground the player walks on.
 */

import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../constants';
import { smoothstep } from '../math/vec3';
import { fractalNoise2D } from './noise';

export interface Terrain {
  /** A label used in logs and save files. */
  readonly kind: string;
  /** Ground height in metres at a world position. */
  heightAt(x: number, z: number): number;
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
 * Ground stays flat through the clearing and its ring of trees, rolls into
 * hills beyond that, and flattens again for the last stretch before the
 * invisible wall at the edge of the world - so neither the clearing nor the
 * boundary ever sit on a slope. Same seed, same hills, on the server and in
 * every browser: nothing about the shape of the ground travels over the wire.
 */
export function createWildernessTerrain(seed: number): Terrain {
  return {
    kind: 'wilderness',
    heightAt: (x, z) => wildernessHeightAt(seed, x, z),
  };
}

/** How much weight the hills get at this distance from the centre: 0 to 1. */
export function wildernessHillWeight(distanceFromCentre: number): number {
  const risingIn = smoothstep(
    distanceFromCentre,
    WILDERNESS.flatRadius,
    WILDERNESS.flatRadius + WILDERNESS.hillBlend,
  );
  const flattenOut =
    1 -
    smoothstep(
      distanceFromCentre,
      PLAYABLE_HALF_EXTENT - WILDERNESS.edgeFlat,
      PLAYABLE_HALF_EXTENT,
    );
  return Math.min(risingIn, flattenOut);
}

export function wildernessHeightAt(seed: number, x: number, z: number): number {
  const weight = wildernessHillWeight(Math.hypot(x, z));
  if (weight <= 0) return 0;
  // Rescaled to roughly [-1, 1] so the ground rises and dips either side of
  // the clearing's own height rather than only ever rising.
  const noise = fractalNoise2D(seed, x * WILDERNESS.noiseScale, z * WILDERNESS.noiseScale) * 2 - 1;
  return noise * WILDERNESS.hillHeight * weight;
}
