import { describe, expect, it } from 'vitest';

import { ITEM_KINDS } from '../src/data/items';
import {
  addItem,
  countOf,
  createInventory,
  hasItem,
  inventoryEntries,
  inventoryFromEntries,
  removeItem,
  roomFor,
} from '../src/sim/inventory';

describe('what a player carries', () => {
  it('starts empty', () => {
    const pack = createInventory();
    expect(countOf(pack, 'log')).toBe(0);
    expect(hasItem(pack, 'axe')).toBe(false);
    expect(inventoryEntries(pack)).toEqual([]);
  });

  it('takes things in and gives them back', () => {
    const pack = createInventory();
    expect(addItem(pack, 'log', 3)).toBe(3);
    expect(countOf(pack, 'log')).toBe(3);
    expect(removeItem(pack, 'log', 2)).toBe(2);
    expect(countOf(pack, 'log')).toBe(1);
  });

  it('stops at ten logs', () => {
    const pack = createInventory();
    expect(addItem(pack, 'log', 8)).toBe(8);
    // Only two of those four fit.
    expect(addItem(pack, 'log', 4)).toBe(2);
    expect(countOf(pack, 'log')).toBe(ITEM_KINDS.log.maxCarry);
    expect(countOf(pack, 'log')).toBe(10);
    expect(roomFor(pack, 'log')).toBe(0);
    // A full pack refuses the next one outright, which is how a pickup knows
    // to leave the item where it is.
    expect(addItem(pack, 'log')).toBe(0);
  });

  it('only lets you hold one axe', () => {
    const pack = createInventory();
    expect(addItem(pack, 'axe')).toBe(1);
    expect(addItem(pack, 'axe')).toBe(0);
    expect(countOf(pack, 'axe')).toBe(1);
  });

  it('keeps the axe and the logs in separate piles', () => {
    const pack = createInventory();
    addItem(pack, 'axe');
    expect(addItem(pack, 'log', 10)).toBe(10);
    // Carrying the axe never costs you room for wood.
    expect(countOf(pack, 'log')).toBe(10);
  });

  it('cannot take out more than is there', () => {
    const pack = createInventory();
    addItem(pack, 'log', 2);
    expect(removeItem(pack, 'log', 5)).toBe(2);
    expect(countOf(pack, 'log')).toBe(0);
    expect(inventoryEntries(pack)).toEqual([]);
  });

  it('ignores nonsense amounts', () => {
    const pack = createInventory();
    expect(addItem(pack, 'log', 0)).toBe(0);
    expect(addItem(pack, 'log', -5)).toBe(0);
    expect(removeItem(pack, 'log', -5)).toBe(0);
    expect(countOf(pack, 'log')).toBe(0);
  });

  it('survives a round trip through storage', () => {
    const pack = createInventory();
    addItem(pack, 'axe');
    addItem(pack, 'log', 4);

    const entries = inventoryEntries(pack);
    expect(entries).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: 4 },
    ]);
    expect(inventoryFromEntries(entries)).toEqual(pack);
  });

  it('clamps a saved pile that is somehow over the limit', () => {
    // A limit lowered between releases must not let an old save exceed it.
    const restored = inventoryFromEntries([{ item: 'log', count: 999 }]);
    expect(countOf(restored, 'log')).toBe(ITEM_KINDS.log.maxCarry);
  });
});
