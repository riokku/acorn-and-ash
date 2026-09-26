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

/**
 * How many more of this item would fit.
 *
 * Nothing fits until a bag has been found - except the bag itself, which is
 * how the first one is ever picked up at all.
 */
export function roomFor(inventory: Inventory, item: ItemId): number {
  if (item !== 'bag' && !hasItem(inventory, 'bag')) return 0;
  return Math.max(0, ITEM_KINDS[item].maxCarry - countOf(inventory, item));
}

/**
 * Put items in, stopping at the carry limit.
 *
 * Returns how many actually went in, which is how the caller knows whether the
 * pack was full - or, before a bag is found, whether there was ever anywhere to
 * put it - so a pickup or a gather that adds nothing must leave the world
 * untouched.
 */
export function addItem(inventory: Inventory, item: ItemId, amount = 1): number {
  if (amount <= 0) return 0;
  const added = Math.min(roomFor(inventory, item), amount);
  if (added > 0) inventory[item] = countOf(inventory, item) + added;
  return added;
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

/**
 * Rebuild a pack from its saved or sent entries.
 *
 * A direct restore, not a run of pickups, so it does not go through `addItem`:
 * a save from before there was a bag to find keeps whatever it already had,
 * the same way a save from before hunger existed starts full rather than
 * empty. Only the per-kind limit is enforced, the same clamp a lowered limit
 * already needs.
 */
export function inventoryFromEntries(
  entries: readonly { readonly item: ItemId; readonly count: number }[],
): Inventory {
  const inventory = createInventory();
  for (const entry of entries) {
    const clamped = Math.min(ITEM_KINDS[entry.item].maxCarry, Math.max(0, entry.count));
    if (clamped > 0) inventory[entry.item] = clamped;
  }
  return inventory;
}
