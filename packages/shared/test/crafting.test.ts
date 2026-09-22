import { describe, expect, it } from 'vitest';

import { ITEM_KINDS } from '../src/data/items';
import { RECIPES, RECIPE_ITEMS, recipeFor } from '../src/data/recipes';
import { canAfford, craft } from '../src/sim/crafting';
import { addItem, countOf, createInventory } from '../src/sim/inventory';

describe('the recipe table', () => {
  it('lists a recipe for the axe and the fishing rod', () => {
    expect(RECIPE_ITEMS).toContain('axe');
    expect(RECIPE_ITEMS).toContain('rod');
  });

  it('makes the axe out of sticks, gathered by hand, not logs', () => {
    // Logs only come from chopping, which needs an axe: a recipe that only
    // spent logs could never make a player's first one.
    const recipe = recipeFor('axe');
    expect(recipe?.costs.some((cost) => cost.item === 'stick')).toBe(true);
    expect(recipe?.costs.some((cost) => cost.item === 'log')).toBe(false);
  });

  it('has nothing to say about an item with no recipe', () => {
    expect(recipeFor('perch')).toBeNull();
  });
});

describe('affording a recipe', () => {
  it('says no with an empty pack', () => {
    const pack = createInventory();
    expect(canAfford(pack, RECIPES.axe!)).toBe(false);
  });

  it('says yes once the pack has enough', () => {
    const pack = createInventory();
    addItem(pack, 'stick', 3);
    expect(canAfford(pack, RECIPES.axe!)).toBe(true);
  });

  it('says no when short by even one', () => {
    const pack = createInventory();
    addItem(pack, 'stick', 2);
    expect(canAfford(pack, RECIPES.axe!)).toBe(false);
  });
});

describe('crafting', () => {
  it('spends the cost and hands over the result', () => {
    const pack = createInventory();
    addItem(pack, 'stick', 3);
    expect(craft(pack, 'axe')).toBe(true);
    expect(countOf(pack, 'stick')).toBe(0);
    expect(countOf(pack, 'axe')).toBe(1);
  });

  it('does nothing without enough materials, and spends nothing either', () => {
    const pack = createInventory();
    addItem(pack, 'stick', 2);
    expect(craft(pack, 'axe')).toBe(false);
    expect(countOf(pack, 'stick')).toBe(2);
    expect(countOf(pack, 'axe')).toBe(0);
  });

  it('refuses a craft the pack has no room for, and spends nothing', () => {
    const pack = createInventory();
    addItem(pack, 'axe');
    addItem(pack, 'stick', 3);
    // Already carrying the one axe this pack can hold.
    expect(craft(pack, 'axe')).toBe(false);
    expect(countOf(pack, 'stick')).toBe(3);
    expect(countOf(pack, 'axe')).toBe(1);
  });

  it('refuses an item that has no recipe at all', () => {
    const pack = createInventory();
    addItem(pack, 'log', 10);
    expect(craft(pack, 'perch')).toBe(false);
  });

  it('makes a fishing rod out of logs', () => {
    const pack = createInventory();
    addItem(pack, 'log', 2);
    expect(craft(pack, 'rod')).toBe(true);
    expect(countOf(pack, 'log')).toBe(0);
    expect(countOf(pack, 'rod')).toBe(1);
  });

  it('leaves other items in the pack untouched', () => {
    const pack = createInventory();
    addItem(pack, 'stick', 5);
    addItem(pack, 'perch', 2);
    craft(pack, 'axe');
    // Two sticks are left over; only the axe's cost was spent.
    expect(countOf(pack, 'stick')).toBe(2);
    expect(countOf(pack, 'perch')).toBe(2);
  });
});

describe('what a recipe is worth', () => {
  it('costs an amount that actually fits in the item it wants', () => {
    for (const item of RECIPE_ITEMS) {
      const recipe = recipeFor(item);
      expect(recipe).not.toBeNull();
      for (const cost of recipe?.costs ?? []) {
        expect(cost.amount).toBeGreaterThan(0);
        expect(cost.amount).toBeLessThanOrEqual(ITEM_KINDS[cost.item].maxCarry);
      }
    }
  });
});
