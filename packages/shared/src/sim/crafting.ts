/**
 * Crafting: turn what is in your pack into a tool.
 *
 * What a recipe costs lives here so the client can show whether it could be
 * afforded, but only the server ever spends anything: it checks the pack
 * again itself before it hands anything over, the same as every other way
 * the pack changes.
 */

import type { ItemId } from '../data/items';
import { recipeFor, type RecipeCost } from '../data/recipes';
import { addItem, countOf, removeItem, roomFor, type Inventory } from './inventory';

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
 * Make one of an item, if there is a recipe for it, the pack can afford it
 * and has room for the result.
 *
 * Nothing is spent on a craft that could not be carried: losing the makings
 * of your only axe to a full pack would be a nasty surprise. Returns whether
 * it happened.
 */
export function craft(inventory: Inventory, item: ItemId): boolean {
  const recipe = recipeFor(item);
  if (recipe === null) return false;
  if (roomFor(inventory, item) === 0) return false;
  if (!canAfford(inventory, recipe)) return false;

  for (const cost of recipe.costs) removeItem(inventory, cost.item, cost.amount);
  addItem(inventory, item);
  return true;
}
