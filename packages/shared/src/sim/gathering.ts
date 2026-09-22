/**
 * Gathering sticks by hand.
 *
 * The rule for what is in reach lives here, the same as a pickup, so the
 * client can light up a hint with it. Unlike a pickup a gather spot is never
 * used up - see `tryGather` in world-sim.ts for the cooldown that stops it
 * being spammed instead.
 */

import { PICKUP_REACH } from '../constants';
import type { Vec3 } from '../math/vec3';
import type { GatherSpot } from '../world/clearing';

/** The nearest gather spot this player could reach right now, or null. */
export function gatherSpotInReach(
  position: Readonly<Vec3>,
  spots: readonly GatherSpot[],
): GatherSpot | null {
  let best: GatherSpot | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const spot of spots) {
    const dx = spot.x - position.x;
    const dz = spot.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = spot;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
