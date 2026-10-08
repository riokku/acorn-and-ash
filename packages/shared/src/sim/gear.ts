/**
 * Putting gear on and taking it off.
 *
 * Wearing moves a piece from the pack into its slot; taking it off moves it
 * back. These are plain rules over a pack and a set of worn slots, so the
 * server and the tests share them. What the server adds on top - not while
 * fighting, not while down - lives in `world-sim.ts`.
 */

import { GEAR_SLOTS, canWearIn, type GearSlot, type WornGear } from '../data/gear';
import type { ItemId } from '../data/items';
import { addItem, hasItem, removeItem, type Inventory } from './inventory';

/** Why a change of gear is refused, in the order they travel the wire. */
export const GEAR_REFUSALS = ['wrongSlot', 'missing', 'noRoom', 'inCombat', 'busy'] as const;

export type GearRefusal =
  /** The piece does not go in that slot, or is not gear at all. */
  | 'wrongSlot'
  /** It is not in the pack, or nothing is worn there. */
  | 'missing'
  /** Whatever it replaces has nowhere to go: the pack is full. */
  | 'noRoom'
  /** Fighting, or in the middle of a move. */
  | 'inCombat'
  /** Down, rowing or casting: not a moment to change clothes. */
  | 'busy';

export type GearChange =
  | { readonly ok: true; readonly displaced: ItemId | null }
  | { readonly ok: false; readonly reason: GearRefusal };

const refused = (reason: GearRefusal): GearChange => ({ ok: false, reason });

/**
 * Put a piece from the pack into a slot. If something is already there it
 * goes back to the pack in its place, a swap. Refuses, changing nothing,
 * when the piece does not fit the slot or is not held.
 */
export function wearGear(
  worn: WornGear,
  pack: Inventory,
  item: ItemId,
  slot: GearSlot,
): GearChange {
  if (!canWearIn(item, slot)) return refused('wrongSlot');
  if (!hasItem(pack, item)) return refused('missing');
  const before = worn[slot] ?? null;
  removeItem(pack, item, 1);
  if (before !== null && addItem(pack, before, 1) < 1) {
    // Put things back exactly as they were: the swap did not happen.
    addItem(pack, item, 1);
    return refused('noRoom');
  }
  worn[slot] = item;
  return { ok: true, displaced: before };
}

/** Take the piece in a slot off, back into the pack. */
export function takeOffGear(worn: WornGear, pack: Inventory, slot: GearSlot): GearChange {
  const item = worn[slot];
  if (item === undefined) return refused('missing');
  if (addItem(pack, item, 1) < 1) return refused('noRoom');
  delete worn[slot];
  return { ok: true, displaced: null };
}

/**
 * Trade the pieces in two slots, as when one is dragged onto the other. Each
 * piece has to fit where it is going; an empty slot just receives the other's
 * piece. Needs no pack room, since nothing leaves the body.
 */
export function swapGear(worn: WornGear, from: GearSlot, to: GearSlot): GearChange {
  const moving = worn[from];
  if (moving === undefined) return refused('missing');
  const meeting = worn[to];
  if (from === to) return { ok: true, displaced: null };
  if (!canWearIn(moving, to)) return refused('wrongSlot');
  if (meeting !== undefined && !canWearIn(meeting, from)) return refused('wrongSlot');
  worn[to] = moving;
  if (meeting === undefined) delete worn[from];
  else worn[from] = meeting;
  return { ok: true, displaced: null };
}

/** Worn gear in slot order, for saving and sending. */
export function wornEntries(worn: Readonly<WornGear>): Array<{ slot: GearSlot; item: ItemId }> {
  const entries: Array<{ slot: GearSlot; item: ItemId }> = [];
  for (const slot of GEAR_SLOTS) {
    const item = worn[slot];
    if (item !== undefined) entries.push({ slot, item });
  }
  return entries;
}

/**
 * Worn gear read back from a save, keeping only what still fits where it was
 * put: a save from before an item existed, or one a slot has since moved on
 * from, never crashes - that piece is simply left out.
 */
export function wornFromEntries(
  entries: readonly { readonly slot: GearSlot; readonly item: ItemId }[] | undefined,
): WornGear {
  const worn: WornGear = {};
  for (const { slot, item } of entries ?? []) {
    if (canWearIn(item, slot) && worn[slot] === undefined) worn[slot] = item;
  }
  return worn;
}
