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
  readonly discoveryId?: number;
  readonly station?: 'campfire';
}

export const RECIPES: Partial<Record<ItemId, Recipe>> = {
  // Gathered by hand, no tool needed, so a brand new player - or a second
  // player in a world where somebody already has the one axe - can make
  // their very first one.
  trailRation: {
    result: 'trailRation',
    discoveryId: 0,
    costs: [
      { item: 'roastedMeat', amount: 1 },
      { item: 'berry', amount: 2 },
    ],
  },
  forestStew: {
    result: 'forestStew',
    discoveryId: 2,
    station: 'campfire',
    costs: [
      { item: 'roastedMeat', amount: 1 },
      { item: 'mushroom', amount: 3 },
    ],
  },
  berryTea: {
    result: 'berryTea',
    discoveryId: 3,
    station: 'campfire',
    costs: [{ item: 'berry', amount: 3 }],
  },
  axe: { result: 'axe', costs: [{ item: 'stick', amount: 3 }] },
  // By the time a second rod is worth making, chopping has already put logs
  // in the pack.
  rod: { result: 'rod', costs: [{ item: 'log', amount: 2 }] },
  // Cheap and gathered by hand, same as the axe - nothing about needing
  // light at night should be blocked behind a tool you don't have yet.
  torch: { result: 'torch', costs: [{ item: 'stick', amount: 2 }] },
};

/** Every craftable item, in the wire order, so the HUD lists recipes the same for everybody. */
export const RECIPE_ITEMS: readonly ItemId[] = ITEM_ORDER.filter((item) => item in RECIPES);

export function recipeFor(item: ItemId): Recipe | null {
  return RECIPES[item] ?? null;
}
