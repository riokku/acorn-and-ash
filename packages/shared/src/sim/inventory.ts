/**
 * What a player is carrying.
 *
 * The server owns every inventory. The client is only ever told what it holds;
 * it never decides, so there is nothing here for a client to lie about.
 */

import { ITEM_KINDS, ITEM_ORDER, type ItemId } from '../data/items';

/** Counts by item. A missing key means none of that item. */
export type Inventory = Partial<Record<ItemId, number>>;

export function createInventory(): Inventory {
  return {};
}

export function countOf(inventory: Inventory, item: ItemId): number {
  return inventory[item] ?? 0;
}

export function hasItem(inventory: Inventory, item: ItemId): boolean {
  return countOf(inventory, item) > 0;
}

/** How many more of this item would fit. */
export function roomFor(inventory: Inventory, item: ItemId): number {
  return Math.max(0, ITEM_KINDS[item].maxCarry - countOf(inventory, item));
}

/**
 * Put items in, stopping at the carry limit.
 *
 * Returns how many actually went in, which is how the caller knows whether the
 * pack was full: a pickup that adds nothing must leave the world untouched.
 */
export function addItem(inventory: Inventory, item: ItemId, amount = 1): number {
  if (amount <= 0) return 0;
  const before = countOf(inventory, item);
  const after = Math.min(ITEM_KINDS[item].maxCarry, before + amount);
  inventory[item] = after;
  return after - before;
}

/** Take items out. Returns how many were actually there to take. */
export function removeItem(inventory: Inventory, item: ItemId, amount = 1): number {
  if (amount <= 0) return 0;
  const before = countOf(inventory, item);
  const taken = Math.min(before, amount);
  const after = before - taken;
  if (after === 0) delete inventory[item];
  else inventory[item] = after;
  return taken;
}

/** Every item held, in the wire order, for sending and for saving. */
export function inventoryEntries(inventory: Inventory): Array<{ item: ItemId; count: number }> {
  const entries: Array<{ item: ItemId; count: number }> = [];
  for (const item of ITEM_ORDER) {
    const count = countOf(inventory, item);
    if (count > 0) entries.push({ item, count });
  }
  return entries;
}

export function inventoryFromEntries(
  entries: readonly { readonly item: ItemId; readonly count: number }[],
): Inventory {
  const inventory = createInventory();
  for (const entry of entries) addItem(inventory, entry.item, entry.count);
  return inventory;
}
