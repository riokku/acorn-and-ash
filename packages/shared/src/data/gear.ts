/**
 * Gear: what a character can wear, and where.
 *
 * Gear is an item (see `data/items.ts`) that fits one or more slots on the
 * body. It leaves the pack for its slot, and for now only changes how a
 * character looks (decision 0113). The slots are listed top to bottom in the
 * order the character screen shows them.
 */

import { ITEM_KINDS, ITEM_ORDER, type ItemId, type ItemKind } from './items';

export const GEAR_SLOTS = [
  'helm',
  'upperBody',
  'lowerBody',
  'feet',
  'hands',
  'mainHand',
  'offHand',
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];

/** What each slot is called on the character screen. */
export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  helm: 'Helm',
  upperBody: 'Upper body',
  lowerBody: 'Lower body',
  feet: 'Feet',
  hands: 'Hands',
  mainHand: 'Main hand',
  offHand: 'Off hand',
};

/** What is worn, slot by slot. A slot with nothing in it is simply missing. */
export type WornGear = Partial<Record<GearSlot, ItemId>>;

/** A slot's number on the wire and in saves. Only ever add to the end. */
export function gearSlotIndex(slot: GearSlot): number {
  return GEAR_SLOTS.indexOf(slot);
}

export function gearSlotFromIndex(index: number): GearSlot | null {
  return GEAR_SLOTS[index] ?? null;
}

/** The slots this can be worn in, or none if it is not gear. */
export function gearSlotsOf(item: ItemId): readonly GearSlot[] {
  const kind: ItemKind = ITEM_KINDS[item];
  return kind.gearSlots ?? [];
}

export function isGear(item: ItemId): boolean {
  return gearSlotsOf(item).length > 0;
}

export function canWearIn(item: ItemId, slot: GearSlot): boolean {
  return gearSlotsOf(item).includes(slot);
}

/** The slot a right-click puts this in: the first it fits, or the empty one if it fits two. */
export function slotToWear(item: ItemId, worn: Readonly<WornGear>): GearSlot | null {
  const slots = gearSlotsOf(item);
  return slots.find((slot) => worn[slot] === undefined) ?? slots[0] ?? null;
}

/** Every piece of gear there is, in the wire order. */
export const GEAR_ITEMS: readonly ItemId[] = ITEM_ORDER.filter(isGear);

/** Whether a piece of gear is something to swing: what goes in the hand. */
export function isWeapon(item: ItemId): boolean {
  return gearSlotsOf(item).includes('mainHand');
}
