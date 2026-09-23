/**
 * The recipe table.
 *
 * What crafting turns into what, and what it costs. Content lives in typed
 * data tables, not scattered through code, so a new recipe means a new row
 * here. Keyed by the item it makes, since nothing has two ways to make it yet.
 */

import { ITEM_ORDER, type ItemId } from './items';

export interface RecipeCost {
  readonly item: ItemId;
  readonly amount: number;
}

export interface Recipe {
  readonly result: ItemId;
  readonly costs: readonly RecipeCost[];
}

export const RECIPES: Partial<Record<ItemId, Recipe>> = {
  // Gathered by hand, no tool needed, so a brand new player - or a second
  // player in a world where somebody already has the one axe - can make
  // their very first one.
  axe: { result: 'axe', costs: [{ item: 'stick', amount: 3 }] },
  // By the time a second rod is worth making, chopping has already put logs
  // in the pack.
  rod: { result: 'rod', costs: [{ item: 'log', amount: 2 }] },
};

/** Every craftable item, in the wire order, so the HUD lists recipes the same for everybody. */
export const RECIPE_ITEMS: readonly ItemId[] = ITEM_ORDER.filter((item) => item in RECIPES);

export function recipeFor(item: ItemId): Recipe | null {
  return RECIPES[item] ?? null;
}
