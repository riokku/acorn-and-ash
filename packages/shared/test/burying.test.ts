import { describe, expect, it } from 'vitest';

import { buryHalf, nearestBuriedCache } from '../src/sim/burying';
import { addItem, createInventory } from '../src/sim/inventory';
import { PICKUP_REACH } from '../src/constants';

describe('buryHalf', () => {
  it('takes half of a stack, rounded down, leaving the player the larger share', () => {
    const inventory = createInventory();
    addItem(inventory, 'log', 7);
    const buried = buryHalf(inventory);
    expect(buried).toEqual([{ item: 'log', count: 3 }]);
    expect(inventory.log).toBe(4);
  });

  it('never touches tools', () => {
    const inventory = createInventory();
    addItem(inventory, 'axe');
    addItem(inventory, 'rod');
    addItem(inventory, 'log', 4);
    const buried = buryHalf(inventory);
    expect(buried).toEqual([{ item: 'log', count: 2 }]);
    expect(inventory.axe).toBe(1);
    expect(inventory.rod).toBe(1);
  });

  it('buries nothing from a stack of one, or an empty pack', () => {
    const inventory = createInventory();
    addItem(inventory, 'stick', 1);
    expect(buryHalf(inventory)).toEqual([]);
    expect(inventory.stick).toBe(1);
    expect(buryHalf(createInventory())).toEqual([]);
  });

  it('covers every non-tool kind being carried at once', () => {
    const inventory = createInventory();
    addItem(inventory, 'log', 4);
    addItem(inventory, 'meat', 2);
    const buried = buryHalf(inventory);
    expect(buried).toEqual([
      { item: 'log', count: 2 },
      { item: 'meat', count: 1 },
    ]);
  });
});

interface FakeCache {
  readonly x: number;
  readonly z: number;
  readonly owner: string;
}

describe('nearestBuriedCache', () => {
  const caches: FakeCache[] = [
    { x: 0, z: 0, owner: 'me' },
    { x: 100, z: 100, owner: 'me' },
    { x: 0.1, z: 0, owner: 'somebody-else' },
  ];

  it('finds a cache within reach that belongs to this player', () => {
    const found = nearestBuriedCache({ x: 0, y: 0, z: 0 }, caches, (c) => c.owner === 'me');
    expect(found).toEqual(caches[0]);
  });

  it("skips a closer cache that is not this player's, even standing right on it", () => {
    const found = nearestBuriedCache({ x: 0.1, y: 0, z: 0 }, caches, (c) => c.owner === 'me');
    expect(found).toEqual(caches[0]);
  });

  it('is null outside reach', () => {
    const far = { x: 0, y: 0, z: PICKUP_REACH + 1 };
    const found = nearestBuriedCache(far, caches, (c) => c.owner === 'me');
    expect(found).toBeNull();
  });
});
