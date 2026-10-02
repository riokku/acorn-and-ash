/**
 * Dropping and destroying things from the pack (see decision 0061).
 *
 * Dropped things lie in a pile where they landed, for anybody to pick up,
 * and fade after `DROPPED_PILE_SECONDS` if nobody does. Destroyed things are
 * simply gone. Either way the bag stays put: it is what the extra slots hang
 * off, and the pack would have nowhere to keep whatever sat in them.
 *
 * Time is passed in rather than read, the same as trees and patches: a world
 * with nobody in it does not tick, and a pile that should have faded while
 * everybody was away has to be gone the moment somebody comes back.
 */

import {
  DROP_DISTANCE,
  DROPPED_PILE_MERGE_RADIUS,
  DROPPED_PILE_SECONDS,
  PICKUP_REACH,
} from '../constants';
import { isPack, type ItemId } from '../data/items';
import type { Vec3 } from '../math/vec3';

/** Things somebody dropped, lying where they landed. */
export interface DroppedPile {
  readonly id: number;
  readonly item: ItemId;
  count: number;
  readonly x: number;
  readonly z: number;
  /** When it becomes available, in real milliseconds. Future times keep felled logs hidden until landing. */
  droppedAtMs: number;
}

/** What a browser is told about a pile: what, how many and where. */
export interface DroppedPileView {
  readonly id: number;
  readonly item: ItemId;
  readonly count: number;
  readonly x: number;
  readonly z: number;
}

/** A pile's count travels in two bytes, so a pile never grows past this. */
export const MAX_PILE_COUNT = 0xffff;

/** Whether this can ever be dropped or destroyed. Everything can except a bag. */
export function isDiscardable(item: ItemId): boolean {
  return !isPack(item);
}

/** Just in front of somebody standing here facing this way: where something they drop lands. */
export function dropSpot(position: Readonly<Vec3>, facingYaw: number): { x: number; z: number } {
  return {
    x: position.x - Math.sin(facingYaw) * DROP_DISTANCE,
    z: position.z - Math.cos(facingYaw) * DROP_DISTANCE,
  };
}

/**
 * The pile this should be added to rather than starting another: the
 * nearest of the same thing close enough to share, with room left in it.
 */
export function pileToMergeInto<T extends DroppedPile>(
  piles: readonly T[],
  item: ItemId,
  count: number,
  x: number,
  z: number,
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = DROPPED_PILE_MERGE_RADIUS * DROPPED_PILE_MERGE_RADIUS;
  for (const pile of piles) {
    if (pile.item !== item || pile.count + count > MAX_PILE_COUNT) continue;
    const dx = pile.x - x;
    const dz = pile.z - z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = pile;
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}

/** The nearest pile this player could pick up right now, or null. */
export function droppedPileInReach<T extends { x: number; z: number; count: number }>(
  position: Readonly<Vec3>,
  piles: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;
  for (const pile of piles) {
    if (pile.count <= 0) continue;
    const dx = pile.x - position.x;
    const dz = pile.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = pile;
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}

/** When this pile fades if nobody picks it up, in real milliseconds. */
export function pileFadesAtMs(pile: Readonly<DroppedPile>): number {
  return pile.droppedAtMs + DROPPED_PILE_SECONDS * 1000;
}

/** What a browser is told about a pile. */
export function pileView(pile: Readonly<DroppedPile>): DroppedPileView {
  return { id: pile.id, item: pile.item, count: pile.count, x: pile.x, z: pile.z };
}
