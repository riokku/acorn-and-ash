import { describe, expect, it } from 'vitest';

import { HUNGER_MAX } from '../src/constants';
import { drainHunger, eat, foodToEat, hungerDrainPerSecond } from '../src/sim/hunger';
import { createInventory, addItem } from '../src/sim/inventory';

describe('draining', () => {
  it('empties a full meter over exactly the given number of seconds', () => {
    const perSecond = hungerDrainPerSecond(1200);
    expect(drainHunger(HUNGER_MAX, 1200, perSecond)).toBe(0);
  });

  it('never goes below zero', () => {
    const perSecond = hungerDrainPerSecond(10);
    expect(drainHunger(5, 100, perSecond)).toBe(0);
  });
});

describe('choosing what to eat', () => {
  it('eats nothing from an empty pack', () => {
    expect(foodToEat(createInventory(), 0)).toBeNull();
  });

  it('will not eat a tool', () => {
    const inventory = createInventory();
    addItem(inventory, 'bag');
    addItem(inventory, 'axe');
    addItem(inventory, 'rod');
    expect(foodToEat(inventory, 0)).toBeNull();
  });

  it('reaches for the common fish first', () => {
    const inventory = createInventory();
    addItem(inventory, 'bag');
    addItem(inventory, 'goldenCarp');
    addItem(inventory, 'perch');
    addItem(inventory, 'trout');
    expect(foodToEat(inventory, 0)).toBe('perch');
  });

  it('does nothing once the meter is already full', () => {
    const inventory = createInventory();
    addItem(inventory, 'bag');
    addItem(inventory, 'perch');
    expect(foodToEat(inventory, HUNGER_MAX)).toBeNull();
  });
});

describe('eating', () => {
  it('restores what the item is worth', () => {
    expect(eat(10, 'perch')).toBe(50);
  });

  it('never goes over a full meter', () => {
    expect(eat(HUNGER_MAX - 5, 'perch')).toBe(HUNGER_MAX);
  });
});
