/**
 * Crafting: turn what is in your pack into a tool.
 *
 * What a recipe costs lives here so the client can show whether it could be
 * afforded, but only the server ever spends anything: it checks the pack
 * again itself before it hands anything over, the same as every other way
 * the pack changes.
 */

import { ITEM_KINDS, type ItemId } from '../data/items';
import { recipeFor, type RecipeCost } from '../data/recipes';
import { addItem, countOf, removeItem, roomFor, type Inventory } from './inventory';

/** Append-only order: indices are used in the refusal wire message. */
export const CRAFT_REFUSALS = [
  'unavailable',
  'recipe',
  'materials',
  'alreadyOwned',
  'packFull',
  'busy',
  'campfire',
  'workbench',
] as const;
export type CraftRefusal = (typeof CRAFT_REFUSALS)[number];

/** Why the pack cannot make this item, without spending anything. */
export function inventoryCraftRefusal(
  inventory: Inventory,
  item: ItemId,
  discoveries = 0,
): CraftRefusal | null {
  const recipe = recipeFor(item);
  if (recipe === null) return 'unavailable';
  if (recipe.discoveryId !== undefined && !(discoveries & (1 << recipe.discoveryId)))
    return 'recipe';
  if (!canAfford(inventory, recipe)) return 'materials';
  const afterSpending = { ...inventory };
  for (const cost of recipe.costs) removeItem(afterSpending, cost.item, cost.amount);
  if (roomFor(afterSpending, item) > 0) return null;
  return ITEM_KINDS[item].maxCarry === 1 && countOf(afterSpending, item) > 0
    ? 'alreadyOwned'
    : 'packFull';
}

/**
 * Whether this pack has everything something costs.
 *
 * Takes anything with a `costs` list rather than a `Recipe` specifically, so
 * a buildable - which makes nothing you carry - can be checked the same way.
 */
export function canAfford(
  inventory: Inventory,
  costed: { readonly costs: readonly RecipeCost[] },
): boolean {
  return costed.costs.every((cost) => countOf(inventory, cost.item) >= cost.amount);
}

/**
 * Whether one of an item could be made right now: there is a recipe for it,
 * the pack can afford it, and there is room for the result once the makings
 * are spent - two sticks used up can free the very slot a torch goes in.
 */
export function canCraft(inventory: Inventory, item: ItemId, discoveries = 0): boolean {
  return inventoryCraftRefusal(inventory, item, discoveries) === null;
}

/**
 * Make one of an item, if `canCraft` says it could be.
 *
 * Nothing is spent on a craft that could not be carried: losing the makings
 * of your only axe to a full pack would be a nasty surprise. Returns whether
 * it happened.
 */
export function craft(inventory: Inventory, item: ItemId, discoveries = 0): boolean {
  const recipe = recipeFor(item);
  if (recipe === null || !canCraft(inventory, item, discoveries)) return false;

  for (const cost of recipe.costs) removeItem(inventory, cost.item, cost.amount);
  addItem(inventory, item);
  return true;
}
