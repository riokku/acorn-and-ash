/**
 * Which item, if any, a player has dragged onto each hotbar slot.
 *
 * Pure and client-only: the server has no notion of slots at all, only of
 * equipping one item id at a time, so nothing here is ever sent over the
 * network. A slot with nothing pinned to it keeps showing whatever wire
 * order would put there, the same as before this existed - see decision
 * 0050 and decision 0040's own note that manual placement was a follow-up.
 */

import { ITEM_ORDER, type ItemId } from '@acorn/shared';

const STORAGE_KEY = 'acorn.hotbarLayout';
export const HOTBAR_SIZE = 6;

/** One entry per slot; null means "whatever wire order would put here." */
export type HotbarPins = readonly (ItemId | null)[];

const EMPTY_LAYOUT: HotbarPins = Array.from({ length: HOTBAR_SIZE }, () => null);

/** Read back whatever was dragged into place last time, falling back to nothing pinned. */
export function readHotbarLayout(storage: Storage): HotbarPins {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return EMPTY_LAYOUT;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_LAYOUT;
    return Array.from({ length: HOTBAR_SIZE }, (_, index) => {
      const value = parsed[index];
      return typeof value === 'string' && ITEM_ORDER.includes(value as ItemId)
        ? (value as ItemId)
        : null;
    });
  } catch {
    // Whatever was in storage was not our own JSON - start fresh rather than throw.
    return EMPTY_LAYOUT;
  }
}

export function writeHotbarLayout(storage: Storage, pins: HotbarPins): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

/**
 * Pin an item to a slot, unpinning it from any other slot first - each item
 * lives in at most one slot, whether the drag started in the pack or on
 * another slot entirely.
 */
export function assignSlot(pins: HotbarPins, slotIndex: number, item: ItemId): HotbarPins {
  const next = pins.map((pin) => (pin === item ? null : pin));
  next[slotIndex] = item;
  return next;
}

/** Unpin whatever is in a slot, handing it back to wire order. */
export function clearSlot(pins: HotbarPins, slotIndex: number): HotbarPins {
  const next = [...pins];
  next[slotIndex] = null;
  return next;
}

/**
 * What each of the six slots actually shows right now: a pin if it has one,
 * otherwise the next carried item that nothing else has claimed, in wire
 * order - the same thing `Hotbar` renders and a hotbar-key press equips, so
 * the two can never disagree about what a given slot means.
 */
export function resolveHotbarSlots(
  carrying: readonly { readonly item: ItemId; readonly count: number }[],
  pins: HotbarPins,
): readonly (ItemId | null)[] {
  const pinned = new Set(pins.filter((pin): pin is ItemId => pin !== null));
  const autoOrder = carrying.map((entry) => entry.item).filter((item) => !pinned.has(item));

  let autoIndex = 0;
  return pins.map((pin) => {
    if (pin !== null) return pin;
    const next = autoOrder[autoIndex] ?? null;
    autoIndex += 1;
    return next;
  });
}
