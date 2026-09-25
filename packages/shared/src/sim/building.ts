/**
 * Placing something in the world.
 *
 * A build always lands at a fixed distance in front of the player, the same
 * as a swing lands on a fixed reach rather than wherever a raycast happens to
 * hit - there is no free-form drag-and-drop yet, only aim and place. Only the
 * server ever decides whether a spot actually counts; the client runs this
 * same check to draw the hint.
 */

import { BUILD_DISTANCE, CLEARING_TREE_LINE_INNER, PICKUP_REACH } from '../constants';
import type { BuildableKindId } from '../data/buildables';
import type { Vec3 } from '../math/vec3';
import { overlapsWater, type WaterCircle } from '../world/water';

/** Something already standing that a new build must not land on top of. */
export interface BuildBlocker {
  readonly x: number;
  readonly z: number;
  readonly footprintRadius: number;
}

/**
 * Where a build in front of this player would land, or null if that spot is
 * no good.
 *
 * No good means: past the tree line (building is a clearing thing, not a
 * wilderness one), on the water, or already sitting on top of a tree, a rock
 * or something already built.
 */
export function buildSpotFor(
  position: Readonly<Vec3>,
  aimYaw: number,
  footprintRadius: number,
  water: readonly WaterCircle[],
  blockers: readonly BuildBlocker[],
): { x: number; z: number } | null {
  // Yaw 0 looks down -Z, matching the way movement and chopping read it.
  const forwardX = -Math.sin(aimYaw);
  const forwardZ = -Math.cos(aimYaw);
  const x = position.x + forwardX * BUILD_DISTANCE;
  const z = position.z + forwardZ * BUILD_DISTANCE;

  if (Math.hypot(x, z) >= CLEARING_TREE_LINE_INNER) return null;
  if (overlapsWater(water, x, z, footprintRadius)) return null;
  for (const blocker of blockers) {
    const reach = blocker.footprintRadius + footprintRadius;
    if (Math.hypot(blocker.x - x, blocker.z - z) < reach) return null;
  }
  return { x, z };
}

/** A built prop, as far as finding the nearest campfire to light or put out needs to know. */
export interface CampfireSpot {
  readonly id: number;
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
}

/**
 * The nearest campfire this player could light or put out, or null.
 *
 * Anyone can toggle any campfire - unlike a buried cache, nothing here is
 * owned - so there is no `isMine`-style filter to pass in.
 */
export function nearestCampfire<T extends CampfireSpot>(
  position: Readonly<Vec3>,
  builtProps: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const prop of builtProps) {
    if (prop.kind !== 'campfire') continue;
    const dx = prop.x - position.x;
    const dz = prop.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = prop;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
