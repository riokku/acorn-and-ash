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
  readonly station?: 'campfire' | 'workbench';
}

export const RECIPES: Partial<Record<ItemId, Recipe>> = {
  refinedAxe: {
    result: 'refinedAxe',
    station: 'workbench',
    costs: [
      { item: 'axe', amount: 1 },
      { item: 'log', amount: 6 },
      { item: 'bone', amount: 4 },
    ],
  },
  refinedRod: {
    result: 'refinedRod',
    station: 'workbench',
    costs: [
      { item: 'rod', amount: 1 },
      { item: 'stick', amount: 6 },
      { item: 'bone', amount: 4 },
    ],
  },
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
  // A wooden handle with a flat stone lashed on: by hand, no station. The stone
  // lies on the mountain, so the first shovel means a walk up there (decision 0114).
  shovel: {
    result: 'shovel',
    costs: [
      { item: 'stick', amount: 2 },
      { item: 'stone', amount: 3 },
    ],
  },
  // Posts and a beam cut from logs, by hand: shoring up a tunnel (decision 0119).
  mineSupport: { result: 'mineSupport', costs: [{ item: 'log', amount: 3 }] },
  // Twisted by hand from reeds cut at the lake, so rope is never behind a tool
  // or a station. It is what the rowboat is lashed together with.
  rope: { result: 'rope', costs: [{ item: 'reed', amount: 3 }] },
};

/** Every craftable item, in the wire order, so the HUD lists recipes the same for everybody. */
export const RECIPE_ITEMS: readonly ItemId[] = ITEM_ORDER.filter((item) => item in RECIPES);

export function recipeFor(item: ItemId): Recipe | null {
  return RECIPES[item] ?? null;
}
