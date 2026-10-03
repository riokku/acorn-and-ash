import type { ItemId } from '../data/items';
import type { RecipeCost } from '../data/recipes';
import type { ChestSlot } from './chest';
import { countOf, inventoryEntries, removeItem, type Inventory } from './inventory';

export interface HomeSupplies {
  readonly homeId: number;
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
}
export function storedHomeSupplies(slots: readonly ChestSlot[]): HomeSupplies['items'] {
  const counts: Inventory = {};
  for (const slot of slots)
    if (slot !== null) counts[slot.item] = countOf(counts, slot.item) + slot.count;
  return inventoryEntries(counts);
}
export function combineHomeSupplies(pack: Inventory, stored: HomeSupplies['items']): Inventory {
  const available = { ...pack };
  for (const entry of stored) available[entry.item] = countOf(available, entry.item) + entry.count;
  return available;
}
/** Validate all supplies before consuming anything; backpack is always used first. */
export function payHomeUpgrade(
  pack: Inventory,
  chest: ChestSlot[],
  costs: readonly RecipeCost[],
): boolean {
  const totals: Inventory = {};
  for (const cost of costs) {
    if (!Number.isInteger(cost.amount) || cost.amount < 1) return false;
    totals[cost.item] = countOf(totals, cost.item) + cost.amount;
  }
  const available = combineHomeSupplies(pack, storedHomeSupplies(chest));
  if (inventoryEntries(totals).some((cost) => countOf(available, cost.item) < cost.count))
    return false;
  for (const cost of inventoryEntries(totals)) {
    let left = cost.count;
    left -= removeItem(pack, cost.item, Math.min(left, countOf(pack, cost.item)));
    for (let index = 0; index < chest.length && left > 0; index++) {
      const slot = chest[index];
      if (slot == null || slot.item !== cost.item) continue;
      const spent = Math.min(left, slot.count);
      left -= spent;
      chest[index] = spent === slot.count ? null : { item: slot.item, count: slot.count - spent };
    }
  }
  return true;
}
