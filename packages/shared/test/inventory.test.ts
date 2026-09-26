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
    addItem(pack, 'bag');
    expect(addItem(pack, 'log', 3)).toBe(3);
    expect(countOf(pack, 'log')).toBe(3);
    expect(removeItem(pack, 'log', 2)).toBe(2);
    expect(countOf(pack, 'log')).toBe(1);
  });

  it('stops at ten logs', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
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
    addItem(pack, 'bag');
    expect(addItem(pack, 'axe')).toBe(1);
    expect(addItem(pack, 'axe')).toBe(0);
    expect(countOf(pack, 'axe')).toBe(1);
  });

  it('keeps the axe and the logs in separate piles', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
    addItem(pack, 'axe');
    expect(addItem(pack, 'log', 10)).toBe(10);
    // Carrying the axe never costs you room for wood.
    expect(countOf(pack, 'log')).toBe(10);
  });

  it('cannot take out more than is there', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
    addItem(pack, 'log', 2);
    expect(removeItem(pack, 'log', 5)).toBe(2);
    expect(countOf(pack, 'log')).toBe(0);
    expect(inventoryEntries(pack)).toEqual([{ item: 'bag', count: 1 }]);
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
    addItem(pack, 'bag');
    addItem(pack, 'axe');
    addItem(pack, 'log', 4);

    const entries = inventoryEntries(pack);
    expect(entries).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: 4 },
      { item: 'bag', count: 1 },
    ]);
    expect(inventoryFromEntries(entries)).toEqual(pack);
  });

  it('clamps a saved pile that is somehow over the limit', () => {
    // A limit lowered between releases must not let an old save exceed it.
    const restored = inventoryFromEntries([{ item: 'log', count: 999 }]);
    expect(countOf(restored, 'log')).toBe(ITEM_KINDS.log.maxCarry);
  });
});

describe('needing a bag first', () => {
  it('holds nothing at all before a bag is found', () => {
    const pack = createInventory();
    expect(addItem(pack, 'log', 3)).toBe(0);
    expect(addItem(pack, 'axe')).toBe(0);
    expect(addItem(pack, 'stick')).toBe(0);
    expect(roomFor(pack, 'log')).toBe(0);
    expect(inventoryEntries(pack)).toEqual([]);
  });

  it('can always be picked up itself, empty pack or not', () => {
    const pack = createInventory();
    expect(roomFor(pack, 'bag')).toBe(1);
    expect(addItem(pack, 'bag')).toBe(1);
    expect(hasItem(pack, 'bag')).toBe(true);
    // Only one - it is a tool, the same as the axe.
    expect(addItem(pack, 'bag')).toBe(0);
  });

  it('carries normally, per-kind limits and all, once a bag is found', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
    expect(addItem(pack, 'log', 12)).toBe(10);
    expect(countOf(pack, 'log')).toBe(ITEM_KINDS.log.maxCarry);
    expect(addItem(pack, 'axe')).toBe(1);
  });

  it('keeps a save from before there was a bag to find, rather than wiping it', () => {
    // Loading a save is a direct restore, not a run of pickups - a player who
    // already had things in their pack before this existed keeps them, the
    // same way a save from before hunger existed starts full rather than
    // empty.
    const restored = inventoryFromEntries([
      { item: 'axe', count: 1 },
      { item: 'log', count: 4 },
    ]);
    expect(countOf(restored, 'axe')).toBe(1);
    expect(countOf(restored, 'log')).toBe(4);
    expect(hasItem(restored, 'bag')).toBe(false);
  });

  it('restores a bag alongside everything else from a save', () => {
    // Wire order, the same order `inventoryEntries` always sends: log before
    // bag, since bag was added to the item table last.
    const entries = [
      { item: 'log' as const, count: 4 },
      { item: 'bag' as const, count: 1 },
    ];
    const restored = inventoryFromEntries(entries);
    expect(hasItem(restored, 'bag')).toBe(true);
    expect(countOf(restored, 'log')).toBe(4);
    expect(inventoryEntries(restored)).toEqual(entries);
  });
});
