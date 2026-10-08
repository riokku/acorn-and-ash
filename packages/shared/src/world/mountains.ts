/**
 * The mountain range in the far south-west (decision 0114).
 *
 * Built from the seed alone, like the hills: the server and every browser
 * reach the same answer and nothing about the shape of the ground travels over
 * the wire. It is a height added on top of the hills, so everywhere outside the
 * range is exactly the ground it was before.
 *
 * The shape is a ridge line with a wide foot. Along it the peaks vary, and
 * across its flanks cliff bands cut in where a coarse noise field crosses a
 * threshold - steep faces with gentle slopes left between them, so there are
 * ways up but not straight up.
 */

import { MOUNTAINS } from '../constants';
import { smoothstep } from '../math/vec3';
import { fractalNoise2D } from './noise';

/** Well clear of the offsets the hills use, so peaks and cliffs never line up with hill bumps. */
const PEAK_SEED_OFFSET = 31337;
const CLIFF_SEED_OFFSET = 52711;
const DETAIL_SEED_OFFSET = 70663;

/** How far a point is from the nearest point on the ridge line, in metres. */
export function distanceToRidge(x: number, z: number): number {
  const { ridgeStart: a, ridgeEnd: b } = MOUNTAINS;
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const along = ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz);
  const t = Math.min(1, Math.max(0, along));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}

/**
 * How much of the range's height applies here, from 0 (outside its foot) to 1
 * (along the spine). Zero beyond the foot, so ordinary ground is untouched.
 */
export function mountainWeight(x: number, z: number): number {
  const distance = distanceToRidge(x, z);
  if (distance >= MOUNTAINS.footRadius) return 0;
  return 1 - smoothstep(distance, MOUNTAINS.coreRadius, MOUNTAINS.footRadius);
}

/** How many metres the range lifts the ground at this spot. */
export function mountainHeightAt(seed: number, x: number, z: number): number {
  const weight = mountainWeight(x, z);
  if (weight <= 0) return 0;

  // Peaks and saddles along the spine rather than one even ridge.
  const peaks = fractalNoise2D(seed + PEAK_SEED_OFFSET, x / 70, z / 70, 3);
  const mass = Math.pow(weight, 1.3) * MOUNTAINS.peakHeight * (0.55 + 0.45 * peaks);

  // Rocky unevenness, strongest on the high ground.
  const detail = (fractalNoise2D(seed + DETAIL_SEED_OFFSET, x / 22, z / 22, 3) * 2 - 1) * 3.5;

  // Cliff bands: a narrow stretch of the noise field is a sheer face. Kept off
  // the foot so the way in from the hills is always a gentle one.
  const cliffField = fractalNoise2D(
    seed + CLIFF_SEED_OFFSET,
    x * MOUNTAINS.cliffNoiseScale,
    z * MOUNTAINS.cliffNoiseScale,
    3,
  );
  const cliffBands = smoothstep(cliffField, 0.5, 0.53) + smoothstep(cliffField, 0.6, 0.63) * 0.8;
  const cliff = cliffBands * MOUNTAINS.cliffHeight * smoothstep(weight, 0.25, 0.55);

  return mass + detail * weight + cliff;
}
