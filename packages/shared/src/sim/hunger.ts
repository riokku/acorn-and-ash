/**
 * Hunger: a meter that runs down while playing, and food tops back up.
 *
 * Cozy-light survival, so running out is a nudge, not a penalty: nothing bad
 * happens yet, on purpose. What eating does lives here so the server can act
 * on it and the client can predict whether pressing the button would do
 * anything.
 */

import { HUNGER_MAX } from '../constants';
import { FOOD_ITEMS, ITEM_KINDS, type ItemId } from '../data/items';
import { countOf, type Inventory } from './inventory';

/** How many points a full meter loses per second, for a meter that empties in this many seconds. */
export function hungerDrainPerSecond(emptyAfterSeconds: number): number {
  return HUNGER_MAX / emptyAfterSeconds;
}

/** Run hunger down by however much time just passed. Never below zero. */
export function drainHunger(hunger: number, deltaSeconds: number, drainPerSecond: number): number {
  return Math.max(0, hunger - drainPerSecond * deltaSeconds);
}

/**
 * Which food this player would eat if they pressed the button right now, or
 * null if they are already full or are not carrying anything to eat.
 *
 * Common fish go first, so a full pack of golden carp is not spent topping up
 * from a single point down.
 */
export function foodToEat(inventory: Inventory, hunger: number): ItemId | null {
  if (hunger >= HUNGER_MAX) return null;
  for (const item of FOOD_ITEMS) {
    if (countOf(inventory, item) > 0) return item;
  }
  return null;
}

/** Eating one restores this item's worth of hunger, capped at a full meter. */
export function eat(hunger: number, item: ItemId): number {
  return Math.min(HUNGER_MAX, hunger + (ITEM_KINDS[item].restoresHunger ?? 0));
}
