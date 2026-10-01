import { describe, expect, it } from 'vitest';

import { ITEM_KINDS } from '../src/data/items';
import {
  BASE_PACK_SLOTS,
  addItem,
  countOf,
  createInventory,
  hasItem,
  inventoryEntries,
  inventoryFromEntries,
  packSlots,
  packStacks,
  removeItem,
  roomFor,
  slotsUsed,
  type Inventory,
} from '../src/sim/inventory';

/** Fill every empty slot with a whole stack of something gathered, one new kind per slot. */
function fillEverySlot(pack: Inventory): void {
  const fillers = ['flower', 'stick', 'meat', 'perch', 'trout', 'goldenCarp'] as const;
  for (const item of fillers) {
    if (slotsUsed(pack) >= packSlots(pack)) return;
    if (!hasItem(pack, item)) addItem(pack, item, ITEM_KINDS[item].stackSize);
  }
}

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

  it('stacks ten of a kind to a slot, and spills the rest into the next', () => {
    const pack = createInventory();
    expect(addItem(pack, 'log', 14)).toBe(14);
    expect(slotsUsed(pack)).toBe(2);
    expect(packStacks(pack)).toEqual([
      { item: 'log', count: 10 },
      { item: 'log', count: 4 },
    ]);
  });

  it('only lets you hold one axe, however much room is left', () => {
    const pack = createInventory();
    expect(addItem(pack, 'axe')).toBe(1);
    expect(addItem(pack, 'axe')).toBe(0);
    expect(countOf(pack, 'axe')).toBe(1);
    expect(roomFor(pack, 'axe')).toBe(0);
  });

  it('gives a tool a whole slot to itself', () => {
    const pack = createInventory();
    addItem(pack, 'axe');
    addItem(pack, 'rod');
    expect(slotsUsed(pack)).toBe(2);
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
    addItem(pack, 'log', 14);

    const entries = inventoryEntries(pack);
    expect(entries).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: 14 },
      { item: 'bag', count: 1 },
    ]);
    expect(inventoryFromEntries(entries)).toEqual(pack);
  });

  it('clamps a saved tool that is somehow over its own limit', () => {
    // A limit lowered between releases must not let an old save exceed it.
    const restored = inventoryFromEntries([{ item: 'axe', count: 3 }]);
    expect(countOf(restored, 'axe')).toBe(1);
  });
});

describe('slots', () => {
  it('starts everybody with six, before any pack is found', () => {
    const pack = createInventory();
    expect(BASE_PACK_SLOTS).toBe(6);
    expect(packSlots(pack)).toBe(6);
    expect(slotsUsed(pack)).toBe(0);
    // Six whole stacks fit, and not a single thing more.
    expect(roomFor(pack, 'log')).toBe(60);
  });

  it('gives four more once the bag is found, for ten', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
    expect(packSlots(pack)).toBe(10);
    expect(roomFor(pack, 'log')).toBe(100);
  });

  it('never spends a slot on the bag itself', () => {
    const pack = createInventory();
    addItem(pack, 'bag');
    expect(slotsUsed(pack)).toBe(0);
    expect(packStacks(pack)).toEqual([]);
  });

  it('refuses something new once every slot is taken', () => {
    const pack = createInventory();
    fillEverySlot(pack);
    expect(slotsUsed(pack)).toBe(6);
    expect(roomFor(pack, 'axe')).toBe(0);
    // A full pack refuses the next one outright, which is how a pickup knows
    // to leave the item where it is.
    expect(addItem(pack, 'axe')).toBe(0);
    expect(hasItem(pack, 'axe')).toBe(false);
  });

  it('still tops up a part-filled stack when every slot is taken', () => {
    const pack = createInventory();
    addItem(pack, 'log', 4);
    fillEverySlot(pack);
    expect(slotsUsed(pack)).toBe(6);
    // Six more logs finish the stack of four; the seventh would need a slot.
    expect(roomFor(pack, 'log')).toBe(6);
    expect(addItem(pack, 'log', 9)).toBe(6);
    expect(countOf(pack, 'log')).toBe(10);
  });

  it('frees a slot the moment its last one is used up', () => {
    const pack = createInventory();
    fillEverySlot(pack);
    removeItem(pack, 'flower', ITEM_KINDS.flower.stackSize);
    expect(slotsUsed(pack)).toBe(5);
    expect(addItem(pack, 'axe')).toBe(1);
  });

  it('lets a bag be picked up into a pack that is already full', () => {
    const pack = createInventory();
    fillEverySlot(pack);
    expect(roomFor(pack, 'bag')).toBe(1);
    expect(addItem(pack, 'bag')).toBe(1);
    // ...and only one: it is a pack, not a pile of them.
    expect(addItem(pack, 'bag')).toBe(0);
    // Four new slots, and the axe fits in one of them.
    expect(packSlots(pack)).toBe(10);
    expect(roomFor(pack, 'axe')).toBe(1);
  });

  it('keeps a save that holds more than its slots would now, rather than wiping it', () => {
    // Loading a save is a direct restore, not a run of pickups - a player who
    // already had things in their pack before slots existed keeps them, the
    // same way a save from before hunger existed starts full rather than
    // empty. They just cannot pick anything new up until there is room.
    const entries = [
      { item: 'axe' as const, count: 1 },
      { item: 'log' as const, count: 10 },
      { item: 'rod' as const, count: 1 },
      { item: 'perch' as const, count: 10 },
      { item: 'trout' as const, count: 10 },
      { item: 'stick' as const, count: 10 },
      { item: 'meat' as const, count: 10 },
    ];
    const restored = inventoryFromEntries(entries);
    expect(inventoryEntries(restored)).toEqual(entries);
    expect(slotsUsed(restored)).toBe(7);
    expect(roomFor(restored, 'flower')).toBe(0);
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
