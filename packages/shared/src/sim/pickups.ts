/**
 * Picking things up.
 *
 * The rule for what is within reach lives here so the client can light up a
 * hint with it, but only the server ever acts on it: the client asks by holding
 * the interact button and is told what it got.
 */

import { PICKUP_REACH } from '../constants';
import type { Vec3 } from '../math/vec3';
import type { PlacedPickup } from '../world/clearing';

/**
 * The nearest pickup this player could take, or null.
 *
 * `isTaken` is asked rather than baked in because the server keeps that set and
 * the client is told it; neither has to hand the other a copy.
 */
export function pickupInReach(
  position: Readonly<Vec3>,
  pickups: readonly PlacedPickup[],
  isTaken: (pickupId: number) => boolean,
): PlacedPickup | null {
  let best: PlacedPickup | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const pickup of pickups) {
    if (isTaken(pickup.id)) continue;
    const dx = pickup.x - position.x;
    const dz = pickup.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = pickup;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
