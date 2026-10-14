import { smoothstep } from '../math/vec3';
import type { WaterCircle } from './water';

/** Broad enough to walk down comfortably, with a low crest above the water. */
export const POND_BANK_WIDTH = 2.6;

/** Shared basin and bank: renderer, walking, camera and scenery use one surface. */
export function pondGroundHeight(
  water: readonly WaterCircle[],
  x: number,
  z: number,
  ground = 0,
): number {
  // The pond is tiny beside the world; avoid square roots on distant terrain.
  if (
    !water.some(
      (c) =>
        Math.abs(x - c.x) < c.radius + POND_BANK_WIDTH &&
        Math.abs(z - c.z) < c.radius + POND_BANK_WIDTH,
    )
  )
    return ground;
  let depth = -Infinity;
  for (const c of water) depth = Math.max(depth, c.radius - Math.hypot(x - c.x, z - c.z));
  if (depth <= -POND_BANK_WIDTH) return ground;
  if (depth >= 0) return -0.04 - 0.7 * smoothstep(depth, 0, 2.5);
  const outside = -depth;
  const width = 2.2 + 0.15 * Math.sin(x * 0.48 + z * 0.19) + 0.1 * Math.sin(z * 0.7);
  const rise = 0.3 + 0.07 * Math.sin(x * 0.35 - z * 0.42);
  const crest = width * 0.5;
  if (outside < crest) return -0.04 + (rise + 0.04) * smoothstep(outside, 0, crest);
  return rise + (ground - rise) * smoothstep(outside, crest, width);
}
