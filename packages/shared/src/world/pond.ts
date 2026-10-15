import { smoothstep } from '../math/vec3';
import { LAKE_WADING_DEPTH } from './lake';
import type { WaterCircle } from './water';

/** Broad enough to walk down comfortably, with a low crest above the water. */
export const POND_BANK_WIDTH = 2.6;
/** The rendered water level and the gently sloping bed underneath it. */
export const POND_LEVEL = 0.03;
export const POND_BED_DEPTH = 1.2;
export const POND_BED_RUN = 2.5;
const POND_SHORE_HEIGHT = -0.04;

/** Distance inside the shoreline where the bed reaches the lake's wading limit. */
export const POND_WADING_SHORE_DEPTH = (() => {
  let low = 0,
    high = POND_BED_RUN;
  for (let pass = 0; pass < 24; pass++) {
    const middle = (low + high) / 2;
    if (waterDepthInside(middle) < LAKE_WADING_DEPTH) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
})();

/** Signed distance inside the union of pond circles; overlaps do not create dry seams. */
function shoreDepthAt(water: readonly WaterCircle[], x: number, z: number): number {
  let depth = -Infinity;
  for (const c of water) depth = Math.max(depth, c.radius - Math.hypot(x - c.x, z - c.z));
  return depth;
}

function waterDepthInside(depth: number): number {
  return POND_LEVEL - POND_SHORE_HEIGHT + POND_BED_DEPTH * smoothstep(depth, 0, POND_BED_RUN);
}

/** Actual water depth in metres, using the same bed as walking and rendering. */
export function pondWaterDepthAt(water: readonly WaterCircle[], x: number, z: number): number {
  const depth = shoreDepthAt(water, x, z);
  return depth < 0 ? 0 : waterDepthInside(depth);
}

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
  const depth = shoreDepthAt(water, x, z);
  if (depth <= -POND_BANK_WIDTH) return ground;
  if (depth >= 0) return POND_LEVEL - waterDepthInside(depth);
  const outside = -depth;
  const width = 2.2 + 0.15 * Math.sin(x * 0.48 + z * 0.19) + 0.1 * Math.sin(z * 0.7);
  const rise = 0.3 + 0.07 * Math.sin(x * 0.35 - z * 0.42);
  const crest = width * 0.5;
  if (outside < crest) return -0.04 + (rise + 0.04) * smoothstep(outside, 0, crest);
  return rise + (ground - rise) * smoothstep(outside, crest, width);
}
