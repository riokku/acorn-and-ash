import { afterEach, describe, expect, it } from 'vitest';
import { WorldSimulation } from '../src/sim/world-sim';
import {
  chestFromSaved,
  depositInChest,
  emptyChest,
  withdrawFromChest,
  type ChestSlot,
} from '../src/sim/chest';
import { countOf, inventoryEntries, type Inventory } from '../src/sim/inventory';
import { HOME_FURNITURE } from '../src/world/home';
import { OUTDOORS } from '../src/sim/world-sim';
import { ClientMessageType, ServerMessageType } from '../src/net/messages';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeChestRequest,
  encodeChestState,
} from '../src/net/protocol';

const worlds: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of worlds.splice(0)) sim.dispose();
});
function atHome() {
  const sim = new WorldSimulation({ seed: 123 });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'cabin', x: 0, z: -20, yaw: 0, lit: false, ownerKey: 'owner', litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  return sim;
}

describe('ten real storage slots', () => {
  it('fills existing stacks before empty slots without changing the total', () => {
    const slots = emptyChest();
    slots[4] = { item: 'log', count: 8 };
    const pack: Inventory = { log: 17 };
    expect(depositInChest(slots, pack, 'log', 17)).toBe(17);
    expect(slots[4]).toEqual({ item: 'log', count: 10 });
    expect(slots[0]).toEqual({ item: 'log', count: 10 });
    expect(slots[1]).toEqual({ item: 'log', count: 5 });
    expect(countOf(pack, 'log')).toBe(0);
  });
  it('keeps excess in the pack when every slot is filled', () => {
    const slots: ChestSlot[] = Array.from({ length: 10 }, () => ({ item: 'log', count: 10 }));
    slots[6] = { item: 'log', count: 9 };
    const pack: Inventory = { log: 3, stick: 1 };
    expect(depositInChest(slots, pack, 'log', 3)).toBe(1);
    expect(countOf(pack, 'log')).toBe(2);
    expect(depositInChest(slots, pack, 'stick', 1)).toBe(0);
    expect(countOf(pack, 'stick')).toBe(1);
  });
  it('withdraws only what fits and keeps the rest in the same slot', () => {
    const slots = emptyChest();
    slots[8] = { item: 'log', count: 10 };
    const pack: Inventory = { log: 59 };
    expect(withdrawFromChest(slots, pack, 8, 10)).toBe(1);
    expect(slots[8]).toEqual({ item: 'log', count: 9 });
    expect(countOf(pack, 'log')).toBe(60);
  });
  it('respects unique-tool limits on withdrawal and never stores a worn pack', () => {
    const slots = emptyChest();
    slots[0] = { item: 'axe', count: 1 };
    const pack: Inventory = { axe: 1, bag: 1 };
    expect(withdrawFromChest(slots, pack, 0, 1)).toBe(0);
    expect(depositInChest(slots, pack, 'bag', 1)).toBe(0);
    expect(pack).toEqual({ axe: 1, bag: 1 });
  });
  it('rejects fractional, negative, infinite and out-of-range transfers', () => {
    const slots = emptyChest();
    const pack: Inventory = { log: 10 };
    for (const amount of [0, -1, 1.5, Infinity, NaN, 65536])
      expect(depositInChest(slots, pack, 'log', amount)).toBe(0);
    expect(withdrawFromChest(slots, pack, 10, 1)).toBe(0);
    expect(pack).toEqual({ log: 10 });
  });
  it('validates saved slots, including unknown items and oversized stacks', () => {
    const slots = emptyChest();
    slots[9] = { item: 'flower', count: 3 };
    expect(chestFromSaved(JSON.parse(JSON.stringify(slots)))).toEqual(slots);
    expect(chestFromSaved([])).toBeNull();
    expect(chestFromSaved([...slots.slice(0, 9), { item: 'nope', count: 1 }])).toBeNull();
    expect(chestFromSaved([...slots.slice(0, 9), { item: 'log', count: 11 }])).toBeNull();
    expect(chestFromSaved([...slots.slice(0, 9), { item: 'bag', count: 1 }])).toBeNull();
  });
});

describe('private cabin storage', () => {
  it('opens for the owner, transfers both directions, and unequips a stored tool', () => {
    const sim = atHome();
    Object.assign(sim.inventoryOf(1), { log: 12, axe: 1 });
    sim.useItem(1, 'axe');
    expect(sim.requestChest(1, { action: 'open' }).reason).toBeNull();
    const deposited = sim.requestChest(1, { action: 'deposit', item: 'log', amount: 12 });
    expect(deposited.moved).toBe(12);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(sim.requestChest(1, { action: 'withdraw', slot: 0, amount: 1 }).moved).toBe(1);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(1);
    expect(sim.requestChest(1, { action: 'deposit', item: 'axe', amount: 1 }).moved).toBe(1);
    expect(sim.equippedItemOf(1)).toBeNull();
  });
  it('does not disclose contents or transfer anything to a visitor', () => {
    const sim = atHome();
    Object.assign(sim.inventoryOf(1), { flower: 6 });
    sim.requestChest(1, { action: 'deposit', item: 'flower', amount: 6 });
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: -1.6, y: 0, z: -0.7 }, 0, 7);
    const denied = sim.requestChest(2, { action: 'withdraw', slot: 0, amount: 6 });
    expect(denied.reason).toBe('private');
    expect(denied.slots).toEqual(emptyChest());
    expect(inventoryEntries(sim.inventoryOf(2))).toEqual([]);
    expect(sim.requestChest(1, { action: 'open' }).slots[0]).toEqual({ item: 'flower', count: 6 });
  });
  it('checks room and distance again on every transfer', () => {
    const sim = atHome();
    Object.assign(sim.inventoryOf(1), { log: 10 });
    sim.requestChest(1, { action: 'deposit', item: 'log', amount: 10 });
    sim.placePlayer(1, { x: 2, y: 0, z: 2 }, 0, 7);
    expect(sim.requestChest(1, { action: 'withdraw', slot: 0, amount: 10 }).reason).toBe('tooFar');
    sim.placePlayer(1, { x: HOME_FURNITURE.chest.x, y: 0, z: HOME_FURNITURE.chest.z }, 0, OUTDOORS);
    expect(sim.requestChest(1, { action: 'open' }).reason).toBe('unavailable');
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
  });
  it('restores exact slot positions when the world wakes again', () => {
    const sim = atHome();
    const slots = emptyChest();
    slots[7] = { item: 'stick', count: 4 };
    sim.restoreChest(7, slots);
    expect(sim.requestChest(1, { action: 'open' }).slots).toEqual(slots);
    slots[7] = null;
    expect(sim.requestChest(1, { action: 'open' }).slots[7]).toEqual({ item: 'stick', count: 4 });
  });
});

describe('storage wire format', () => {
  it('round-trips open and transfer requests', () => {
    for (const request of [
      { action: 'open' } as const,
      { action: 'deposit', item: 'log', amount: 10 } as const,
      { action: 'withdraw', slot: 9, amount: 1 } as const,
    ])
      expect(decodeClientMessage(encodeChestRequest(request))).toEqual({
        type: 'chest',
        ...request,
      });
  });
  it('rejects malformed lengths, actions, zero counts and invalid slots', () => {
    for (const bytes of [
      [ClientMessageType.Chest],
      [ClientMessageType.Chest, 0, 0],
      [ClientMessageType.Chest, 3, 0, 1, 0],
      [ClientMessageType.Chest, 2, 10, 1, 0],
      [ClientMessageType.Chest, 1, 255, 1, 0],
      [ClientMessageType.Chest, 2, 0, 0, 0],
    ])
      expect(decodeClientMessage(new Uint8Array(bytes).buffer)).toBeNull();
  });
  it('preserves all ten slots and failure feedback', () => {
    const slots = emptyChest();
    slots[9] = { item: 'log', count: 5 };
    const state = { homeId: 7, slots, moved: 1, reason: 'packFull' as const };
    expect(decodeServerMessage(encodeChestState(state))).toEqual({ type: 'chest', ...state });
    const bad = new Uint8Array(encodeChestState(state));
    bad[3] = 255;
    expect(decodeServerMessage(bad.buffer)).toBeNull();
    expect(decodeServerMessage(new Uint8Array([ServerMessageType.Chest]).buffer)).toBeNull();
  });
});
