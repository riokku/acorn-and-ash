/**
 * Water: where it is, and whether a point is in it.
 *
 * A body of water is a few overlapping circles. That gives a pond a shape with
 * some character while staying something the collision code already knows how
 * to push a player out of: each circle becomes a cylinder you cannot walk into.
 */

import {
  CAST_DISTANCE_MAX,
  CAST_DISTANCE_MIN,
  FLOAT_SHORE_MARGIN,
  WATER_WALL_HEIGHT,
} from '../constants';
import type { Vec3 } from '../math/vec3';
import { cylinder, type Collider } from './colliders';

/** One round patch of water. A pond is several of these, overlapping. */
export interface WaterCircle {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/** Where a cast float comes to rest. */
export interface FloatSpot {
  readonly x: number;
  readonly z: number;
}

/**
 * Is this point on the water, at least `margin` in from the bank?
 *
 * The margin is measured against each circle on its own, which is a little
 * cautious where two circles meet. Cautious is the right way round: a float
 * that lands a touch further out than it needed to is never on the grass.
 */
export function isOnWater(
  water: readonly WaterCircle[],
  x: number,
  z: number,
  margin = 0,
): boolean {
  for (const circle of water) {
    const inner = circle.radius - margin;
    if (inner <= 0) continue;
    const dx = x - circle.x;
    const dz = z - circle.z;
    if (dx * dx + dz * dz <= inner * inner) return true;
  }
  return false;
}

/** The walls that keep players out of the water, one per circle. */
export function waterColliders(water: readonly WaterCircle[]): Collider[] {
  return water.map((circle) => cylinder(circle.x, circle.z, circle.radius, WATER_WALL_HEIGHT));
}

/** How finely the cast looks for water between its longest and shortest throw. */
const CAST_SEARCH_STEP = 0.25;

/**
 * Where a cast from here would land, or null if there is no water to cast into.
 *
 * As far out as the water allows, looking along where the camera points: from
 * the longest throw inwards, the first spot that is properly on the water wins.
 * Facing the pond from its bank lands out in the middle; facing a narrow neck
 * lands short rather than on the far bank; facing the grass finds nothing.
 */
export function castLanding(
  position: Readonly<Vec3>,
  aimYaw: number,
  water: readonly WaterCircle[],
): FloatSpot | null {
  // Yaw 0 looks down -Z, the same way movement and chopping read it.
  const forwardX = -Math.sin(aimYaw);
  const forwardZ = -Math.cos(aimYaw);

  for (
    let distance = CAST_DISTANCE_MAX;
    distance >= CAST_DISTANCE_MIN - 1e-9;
    distance -= CAST_SEARCH_STEP
  ) {
    const x = position.x + forwardX * distance;
    const z = position.z + forwardZ * distance;
    if (isOnWater(water, x, z, FLOAT_SHORE_MARGIN)) return { x, z };
  }
  return null;
}

/** Does anything with this footprint poke into the water? */
export function overlapsWater(
  water: readonly WaterCircle[],
  x: number,
  z: number,
  footprintRadius: number,
): boolean {
  for (const circle of water) {
    const reach = circle.radius + footprintRadius;
    const dx = x - circle.x;
    const dz = z - circle.z;
    if (dx * dx + dz * dz < reach * reach) return true;
  }
  return false;
}
