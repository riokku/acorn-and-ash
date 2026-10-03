import { describe, expect, it } from 'vitest';
import {
  payHomeUpgrade,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  storedHomeSupplies,
  combineHomeSupplies,
  encodeHomeSupplies,
  decodeServerMessage,
  type ChestSlot,
} from '../src/index';
describe('private upgrade supplies', () => {
  it('spends backpack first and preserves unrelated chest items', () => {
    const pack = { log: 4, stick: 16 };
    const chest: ChestSlot[] = [
      { item: 'log', count: 10 },
      { item: 'bone', count: 3 },
      ...Array(8).fill(null),
    ];
    expect(
      payHomeUpgrade(pack, chest, [
        { item: 'log', amount: 12 },
        { item: 'stick', amount: 16 },
      ]),
    ).toBe(true);
    expect(pack).toEqual({});
    expect(chest.slice(0, 2)).toEqual([
      { item: 'log', count: 2 },
      { item: 'bone', count: 3 },
    ]);
    expect(storedHomeSupplies(chest)).toEqual([
      { item: 'log', count: 2 },
      { item: 'bone', count: 3 },
    ]);
  });
  it('aggregates repeated costs and validates everything before spending', () => {
    const pack = { log: 4 };
    const chest: ChestSlot[] = [{ item: 'log', count: 10 }];
    const before = structuredClone({ pack, chest });
    expect(
      payHomeUpgrade(pack, chest, [
        { item: 'log', amount: 10 },
        { item: 'log', amount: 5 },
      ]),
    ).toBe(false);
    expect({ pack, chest }).toEqual(before);
    expect(payHomeUpgrade(pack, chest, [{ item: 'log', amount: -1 }])).toBe(false);
    expect(combineHomeSupplies(pack, storedHomeSupplies(chest))).toEqual({ log: 14 });
    expect({ pack, chest }).toEqual(before);
  });
  it('round-trips private totals and rejects malformed messages', () => {
    const state = { homeId: 7, items: [{ item: 'log' as const, count: 12 }] };
    expect(decodeServerMessage(encodeHomeSupplies(state))).toEqual({
      type: 'homeSupplies',
      ...state,
    });
    const encoded = encodeHomeSupplies(state);
    expect(decodeServerMessage(encoded.slice(0, -1))).toBeNull();
    new DataView(encoded).setUint16(7, 0, true);
    expect(decodeServerMessage(encoded)).toBeNull();
    expect(decodeServerMessage(encodeHomeSupplies({ homeId: 0, items: state.items }))).toBeNull();
    expect(
      decodeServerMessage(
        encodeHomeSupplies({ homeId: 7, items: [...state.items, ...state.items] }),
      ),
    ).toBeNull();
  });
});

it('reports only the recipient’s own home supplies', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  try {
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'tent',
        x: 0,
        z: -4.2,
        yaw: 0,
        lit: false,
        ownerKey: 'owner',
        litUntilMs: null,
      },
    ]);
    sim.restoreChest(7, [{ item: 'log', count: 10 }, ...Array(9).fill(null)]);
    sim.addPlayer(1, undefined, 'owner');
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0, 7);
    expect(sim.homeSuppliesOf(1)).toEqual({ homeId: 7, items: [{ item: 'log', count: 10 }] });
    expect(sim.homeSuppliesOf(2)).toEqual({ homeId: 0, items: [] });
    const copy = sim.chestSlots(7);
    expect(copy[0]).toEqual({ item: 'log', count: 10 });
    if (copy[0]) Object.assign(copy[0], { count: 1 });
    expect(sim.homeSuppliesOf(1).items[0]?.count).toBe(10);
  } finally {
    sim.dispose();
  }
});
