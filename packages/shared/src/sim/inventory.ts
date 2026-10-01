/**
 * What a player is carrying.
 *
 * The server owns every inventory. The client is only ever told what it holds;
 * it never decides, so there is nothing here for a client to lie about.
 *
 * Room is a shared set of slots rather than a limit per kind (see decision
 * 0060): everybody starts with six, a pack adds more, and each slot holds one
 * stack of one thing. The pack itself is still only ever counts by item - the
 * slots are worked out from those counts, never stored - so nothing about
 * saving or sending a pack had to change.
 */

import { ITEM_KINDS, ITEM_ORDER, PACK_ITEMS, isPack, type ItemId } from '../data/items';

/** Counts by item. A missing key means none of that item. */
export type Inventory = Partial<Record<ItemId, number>>;

/** One slot's worth of one item: a full stack, or the part-filled one at the end. */
export interface PackStack {
  readonly item: ItemId;
  readonly count: number;
}

/** Slots everybody has before finding any pack at all. */
export const BASE_PACK_SLOTS = 6;

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
 * How many slots this player has: the six everybody starts with, plus
 * whatever the biggest pack they carry adds. Only one pack counts - you wear
 * one on your back, not a pile of them.
 */
export function packSlots(inventory: Inventory): number {
  let extra = 0;
  for (const item of PACK_ITEMS) {
    if (hasItem(inventory, item)) extra = Math.max(extra, ITEM_KINDS[item].extraSlots ?? 0);
  }
  return BASE_PACK_SLOTS + extra;
}

/** Slots this many of one item take up: one per stack, full or not. A pack takes none. */
function slotsFor(item: ItemId, count: number): number {
  if (count <= 0 || isPack(item)) return 0;
  return Math.ceil(count / ITEM_KINDS[item].stackSize);
}

/** How many of this player's slots already have something in them. */
export function slotsUsed(inventory: Inventory): number {
  let used = 0;
  for (const item of ITEM_ORDER) used += slotsFor(item, countOf(inventory, item));
  return used;
}

/**
 * How many more of this item would fit.
 *
 * Whatever room is left at the top of its last part-filled stack, plus a
 * whole stack for every empty slot - never more than the item's own limit,
 * so a second axe never fits however empty the pack is. A pack is the
 * exception: it never takes a slot, which is how one can always be picked up
 * even into a pack that is already full.
 */
export function roomFor(inventory: Inventory, item: ItemId): number {
  const kind = ITEM_KINDS[item];
  const count = countOf(inventory, item);
  const underLimit =
    kind.maxCarry === undefined ? Number.POSITIVE_INFINITY : Math.max(0, kind.maxCarry - count);
  if (isPack(item)) return underLimit;

  const topUp = slotsFor(item, count) * kind.stackSize - count;
  const emptySlots = Math.max(0, packSlots(inventory) - slotsUsed(inventory));
  return Math.min(underLimit, topUp + emptySlots * kind.stackSize);
}

/**
 * Put items in, stopping once there is no more room.
 *
 * Returns how many actually went in, which is how the caller knows whether the
 * pack was full, so a pickup or a gather that adds nothing must leave the
 * world untouched.
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
 * What is in each filled slot, in the wire order: fourteen logs are a stack
 * of ten and a stack of four. Packs are left out, since they are what the
 * slots are in rather than something sitting in one.
 */
export function packStacks(inventory: Inventory): PackStack[] {
  const stacks: PackStack[] = [];
  for (const item of ITEM_ORDER) {
    if (isPack(item)) continue;
    const { stackSize } = ITEM_KINDS[item];
    let left = countOf(inventory, item);
    while (left > 0) {
      const count = Math.min(stackSize, left);
      stacks.push({ item, count });
      left -= count;
    }
  }
  return stacks;
}

/**
 * Rebuild a pack from its saved or sent entries.
 *
 * A direct restore, not a run of pickups, so it does not go through `addItem`:
 * a save from before there were slots keeps whatever it already had, even
 * more than its slots would hold now, the same way a save from before hunger
 * existed starts full rather than empty. Only an item's own limit is
 * enforced - the one axe - the same clamp a lowered limit already needs.
 */
export function inventoryFromEntries(
  entries: readonly { readonly item: ItemId; readonly count: number }[],
): Inventory {
  const inventory = createInventory();
  for (const entry of entries) {
    const limit = ITEM_KINDS[entry.item].maxCarry ?? Number.POSITIVE_INFINITY;
    const clamped = Math.min(limit, Math.max(0, entry.count));
    if (clamped > 0) inventory[entry.item] = clamped;
  }
  return inventory;
}
