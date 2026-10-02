/**
 * Campfire cooking.
 *
 * Cooking is deliberately a small transformation, not a second crafting
 * system: hold raw food beside a lit campfire and one piece becomes its
 * roasted counterpart. Both ends use this table so hints and server authority
 * cannot disagree about what can be cooked.
 */

import type { ItemId } from '../data/items';
import {
  addItem,
  countOf,
  removeItem,
  roomFor,
  type Inventory,
} from './inventory';

export const COOKING_RESULTS = {
  perch: 'roastedPerch',
  trout: 'roastedTrout',
  goldenCarp: 'roastedGoldenCarp',
  meat: 'roastedMeat',
} as const satisfies Partial<Record<ItemId, ItemId>>;

export const COOKED_FOODS: readonly ItemId[] = [
  'roastedPerch',
  'roastedTrout',
  'roastedGoldenCarp',
  'roastedMeat',
];

const RAW_BY_COOKED = new Map<ItemId, ItemId>(
  Object.entries(COOKING_RESULTS).map(([raw, cooked]) => [cooked, raw as ItemId]),
);

/** What one raw item becomes over a campfire, or null when it is not cookable. */
export function cookedItemFor(item: ItemId): ItemId | null {
  return COOKING_RESULTS[item as keyof typeof COOKING_RESULTS] ?? null;
}

/** The raw food a cooked item came from, or null for everything else. */
export function rawItemForCooked(item: ItemId): ItemId | null {
  return RAW_BY_COOKED.get(item) ?? null;
}

export function isCookedFood(item: ItemId): boolean {
  return RAW_BY_COOKED.has(item);
}

/**
 * Whether one piece can be transformed without overflowing the pack.
 *
 * Removing the raw piece happens conceptually first: if it was the last thing
 * in its stack, that newly-freed slot is allowed to hold the cooked result.
 */
export function canCook(inventory: Inventory, item: ItemId): boolean {
  const result = cookedItemFor(item);
  if (result === null || countOf(inventory, item) <= 0) return false;

  const afterTakingRaw: Inventory = { ...inventory };
  removeItem(afterTakingRaw, item);
  return roomFor(afterTakingRaw, result) > 0;
}

/**
 * Cook exactly one piece. Returns the cooked item, or null without changing
 * anything when the food cannot be cooked or the result would not fit.
 */
export function cookOne(inventory: Inventory, item: ItemId): ItemId | null {
  const result = cookedItemFor(item);
  if (result === null || !canCook(inventory, item)) return null;

  removeItem(inventory, item);
  const added = addItem(inventory, result);
  if (added !== 1) {
    // Defensive rollback: canCook above should make this impossible, but an
    // inventory transform must never eat a player's food if that invariant
    // changes later.
    addItem(inventory, item);
    return null;
  }
  return result;
}
