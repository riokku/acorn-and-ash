import { describe, expect, it } from 'vitest';

import {
  assignSlot,
  clearSlot,
  readHotbarLayout,
  resolveHotbarSlots,
  writeHotbarLayout,
  type HotbarPins,
} from '../src/hud/hotbar-layout';

const NOTHING_PINNED: HotbarPins = [null, null, null, null, null, null];

describe('resolving what a hotbar slot shows', () => {
  it('falls back to wire order when nothing has been pinned', () => {
    const carrying = [
      { item: 'axe' as const, count: 1 },
      { item: 'log' as const, count: 4 },
    ];
    expect(resolveHotbarSlots(carrying, NOTHING_PINNED)).toEqual([
      'axe',
      'log',
      null,
      null,
      null,
      null,
    ]);
  });

  it('shows a pinned item in its own slot, wherever it falls in wire order', () => {
    const carrying = [
      { item: 'axe' as const, count: 1 },
      { item: 'log' as const, count: 4 },
    ];
    const pins = assignSlot(NOTHING_PINNED, 5, 'log');
    expect(resolveHotbarSlots(carrying, pins)).toEqual(['axe', null, null, null, null, 'log']);
  });

  it('never shows a pinned item a second time in an auto slot', () => {
    const carrying = [
      { item: 'axe' as const, count: 1 },
      { item: 'rod' as const, count: 1 },
    ];
    const pins = assignSlot(NOTHING_PINNED, 0, 'rod');
    // Slot 0 is pinned to the rod; the axe fills the next open auto slot
    // (slot 1) rather than slot 0 simply because it is first in wire order.
    expect(resolveHotbarSlots(carrying, pins)).toEqual(['rod', 'axe', null, null, null, null]);
  });

  it('leaves the bag out, since it has a button of its own', () => {
    const carrying = [
      { item: 'axe' as const, count: 1 },
      { item: 'bag' as const, count: 1 },
      { item: 'torch' as const, count: 1 },
    ];
    expect(resolveHotbarSlots(carrying, NOTHING_PINNED)).toEqual([
      'axe',
      'torch',
      null,
      null,
      null,
      null,
    ]);
  });

  it('keeps showing a pin even if that item is not currently carried', () => {
    const pins = assignSlot(NOTHING_PINNED, 2, 'torch');
    expect(resolveHotbarSlots([], pins)).toEqual([null, null, 'torch', null, null, null]);
  });
});

describe('assigning and clearing a slot', () => {
  it('moves an item rather than duplicating it when it is dragged to a new slot', () => {
    const first = assignSlot(NOTHING_PINNED, 1, 'axe');
    const moved = assignSlot(first, 4, 'axe');
    expect(moved).toEqual([null, null, null, null, 'axe', null]);
  });

  it('hands a slot back to auto order', () => {
    const pinned = assignSlot(NOTHING_PINNED, 3, 'rod');
    expect(clearSlot(pinned, 3)).toEqual(NOTHING_PINNED);
  });
});

describe('reading and writing the layout in storage', () => {
  function fakeStorage(): Storage {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
      clear: () => data.clear(),
      key: () => null,
      get length() {
        return data.size;
      },
    };
  }

  it('starts with nothing pinned when storage is empty', () => {
    expect(readHotbarLayout(fakeStorage())).toEqual(NOTHING_PINNED);
  });

  it('round-trips a real layout', () => {
    const storage = fakeStorage();
    const pins = assignSlot(assignSlot(NOTHING_PINNED, 0, 'axe'), 5, 'rod');
    writeHotbarLayout(storage, pins);
    expect(readHotbarLayout(storage)).toEqual(pins);
  });

  it('ignores storage that is not its own JSON, rather than throwing', () => {
    const storage = fakeStorage();
    storage.setItem('acorn.hotbarLayout', 'not json');
    expect(readHotbarLayout(storage)).toEqual(NOTHING_PINNED);
  });

  it('drops an unrecognised item id instead of trusting it', () => {
    const storage = fakeStorage();
    storage.setItem('acorn.hotbarLayout', JSON.stringify(['griffin-saddle', null, null]));
    expect(readHotbarLayout(storage)).toEqual(NOTHING_PINNED);
  });
});
