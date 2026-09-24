/**
 * What a knockout costs, and finding it again.
 *
 * Half of what you were carrying, tools aside, stays where you fell rather
 * than following you home - a real cost, but never the tools you would need
 * to get back on your feet. The rule for what is in reach of the spot lives
 * here, the same reason `pickupInReach` does: a hint can light up on it, but
 * only the server ever hands the pack back over.
 */

import { PICKUP_REACH } from '../constants';
import { ITEM_KINDS, ITEM_ORDER, type ItemId } from '../data/items';
import { countOf, removeItem, type Inventory } from './inventory';
import type { Vec3 } from '../math/vec3';

/** Half of everything but tools, rounded down - the player keeps the larger share. */
export function buryHalf(inventory: Inventory): Array<{ item: ItemId; count: number }> {
  const buried: Array<{ item: ItemId; count: number }> = [];
  for (const item of ITEM_ORDER) {
    if (ITEM_KINDS[item].keepOnKnockout) continue;
    const toBury = Math.floor(countOf(inventory, item) / 2);
    if (toBury <= 0) continue;
    removeItem(inventory, item, toBury);
    buried.push({ item, count: toBury });
  }
  return buried;
}

export interface BuriedCacheSpot {
  readonly x: number;
  readonly z: number;
}

/**
 * The nearest cache this player could dig up, or null.
 *
 * `isMine` is asked rather than baked in because who owns a cache is tracked
 * differently on each side: the server knows it by the stable key a player
 * carries between sessions, and the client only ever hears the network id of
 * whoever currently holds that key.
 */
export function nearestBuriedCache<T extends BuriedCacheSpot>(
  position: Readonly<Vec3>,
  caches: readonly T[],
  isMine: (cache: T) => boolean,
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const cache of caches) {
    if (!isMine(cache)) continue;
    const dx = cache.x - position.x;
    const dz = cache.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = cache;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
