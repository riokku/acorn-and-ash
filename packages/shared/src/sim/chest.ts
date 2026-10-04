import { ITEM_KINDS, isPack, type ItemId } from '../data/items';
import { addItem, countOf, removeItem, roomFor, type Inventory } from './inventory';

export const CHEST_SLOTS = 10;
export interface ChestStack {
  readonly item: ItemId;
  readonly count: number;
}
export type ChestSlot = ChestStack | null;
export type ChestRequest =
  | { readonly action: 'open' }
  | { readonly action: 'storeSupplies' }
  | { readonly action: 'deposit'; readonly item: ItemId; readonly amount: number }
  | { readonly action: 'withdraw'; readonly slot: number; readonly amount: number };
export const CHEST_REASONS = [
  'unavailable',
  'private',
  'tooFar',
  'busy',
  'chestFull',
  'packFull',
  'empty',
  'invalid',
] as const;
export type ChestReason = (typeof CHEST_REASONS)[number];
export interface ChestResult {
  readonly homeId: number;
  readonly slots: readonly ChestSlot[];
  readonly moved: number;
  readonly reason: ChestReason | null;
}
export function emptyChest(): ChestSlot[] {
  return Array.from({ length: CHEST_SLOTS }, () => null);
}
export function validTransferAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 65535;
}

/** A chest uses real slots, preserves their order, and never counts bags as capacity. */
export function depositInChest(
  slots: ChestSlot[],
  inventory: Inventory,
  item: ItemId,
  amount: number,
): number {
  if (!validTransferAmount(amount) || isPack(item) || slots.length !== CHEST_SLOTS) return 0;
  let left = Math.min(amount, countOf(inventory, item));
  const start = left;
  const limit = ITEM_KINDS[item].stackSize;
  for (let i = 0; i < slots.length && left > 0; i++) {
    const stack = slots[i];
    if (stack?.item !== item) continue;
    const moved = Math.min(left, limit - stack.count);
    slots[i] = { item, count: stack.count + moved };
    left -= moved;
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] !== null) continue;
    const moved = Math.min(left, limit);
    slots[i] = { item, count: moved };
    left -= moved;
  }
  const moved = start - left;
  removeItem(inventory, item, moved);
  return moved;
}
export function withdrawFromChest(
  slots: ChestSlot[],
  inventory: Inventory,
  slot: number,
  amount: number,
): number {
  if (!validTransferAmount(amount) || !Number.isInteger(slot) || slot < 0 || slot >= CHEST_SLOTS)
    return 0;
  const stack = slots[slot];
  if (stack == null) return 0;
  const moved = Math.min(amount, stack.count, roomFor(inventory, stack.item));
  if (moved === 0) return 0;
  addItem(inventory, stack.item, moved);
  slots[slot] = moved === stack.count ? null : { item: stack.item, count: stack.count - moved };
  return moved;
}
/** Reject malformed saves rather than silently moving items between slots. */
export function chestFromSaved(value: unknown): ChestSlot[] | null {
  if (!Array.isArray(value) || value.length !== CHEST_SLOTS) return null;
  const slots: ChestSlot[] = [];
  for (const entry of value) {
    if (entry === null) {
      slots.push(null);
      continue;
    }
    if (typeof entry !== 'object' || entry === null) return null;
    const { item, count } = entry as { item?: unknown; count?: unknown };
    if (typeof item !== 'string' || !Object.hasOwn(ITEM_KINDS, item) || typeof count !== 'number')
      return null;
    const id = item as ItemId;
    if (isPack(id) || !Number.isInteger(count) || count < 1 || count > ITEM_KINDS[id].stackSize)
      return null;
    slots.push({ item: id, count });
  }
  return slots;
}

/** Leaves tools, meals, raw food, blueprints and earned trophies ready for the next outing. */
export const CHEST_BUILDING_SUPPLIES = ['log', 'stick', 'bone', 'flower'] as const;
export function storeBuildingSupplies(
  slots: ChestSlot[],
  inventory: Inventory,
): { moved: number; left: number } {
  let moved = 0,
    left = 0;
  for (const item of CHEST_BUILDING_SUPPLIES) {
    const count = countOf(inventory, item);
    if (count === 0) continue;
    moved += depositInChest(slots, inventory, item, count);
    left += countOf(inventory, item);
  }
  return { moved, left };
}
