import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  PlayerButton,
  createInput,
  countOf,
  emptyChest,
  storeBuildingSupplies,
  encodeRecoveryMarkers,
  encodeCache,
  encodeChestRequest,
  decodeServerMessage,
  decodeClientMessage,
  type ChestSlot,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));
it('keeps a full and partially recovered cache until every item fits', () => {
  const sim = new WorldSimulation({ seed: 123 });
  worlds.push(sim);
  sim.addPlayer(1, undefined, 'owner');
  sim.restoreBuriedCaches([
    { id: 70000, ownerPlayerKey: 'owner', x: 0, z: 10, items: [{ item: 'log', count: 4 }] },
  ]);
  const pack = sim.inventoryOf(1);
  Object.assign(pack, { log: 60 });
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(0);
  expect(countOf(pack, 'log')).toBe(60);
  expect(sim.buriedCachesList()).toHaveLength(1);
  expect(sim.drainCacheEvents()).toEqual([]);
  pack.log = 58;
  sim.queueInput(1, createInput(2, 0, 0, 0, 0));
  sim.step(50);
  sim.queueInput(1, createInput(3, 0, 0, 0, PlayerButton.Interact));
  sim.step(100);
  expect(countOf(pack, 'log')).toBe(60);
  expect(sim.drainCacheEvents()).toEqual([
    {
      netId: 1,
      kind: 'partial',
      cache: {
        id: 70000,
        ownerPlayerKey: 'owner',
        x: 0,
        z: 10,
        items: [{ item: 'log', count: 2 }],
      },
    },
  ]);
  expect(sim.buriedCachesList()[0]?.id).toBe(70000);
  pack.log = 0;
  sim.queueInput(1, createInput(4, 0, 0, 0, 0));
  sim.step(150);
  sim.queueInput(1, createInput(5, 0, 0, 0, PlayerButton.Interact));
  sim.step(200);
  expect(countOf(pack, 'log')).toBe(2);
  expect(sim.buriedCachesList()).toEqual([]);
  expect(sim.drainCacheEvents()).toEqual([{ netId: 1, kind: 'dugUp', cacheId: 70000 }]);
});
it('transports every private marker with full-width IDs, and rejects corrupt payloads', () => {
  const caches = Array.from({ length: 300 }, (_, i) => ({
    id: 70000 + i,
    ownerNetId: 1,
    x: i / 100,
    z: 10,
  }));
  expect(decodeServerMessage(encodeRecoveryMarkers(caches))).toEqual({
    type: 'recoveryMarkers',
    caches,
  });
  expect(decodeServerMessage(encodeRecoveryMarkers(caches).slice(0, -1))).toBeNull();
  expect(decodeServerMessage(encodeRecoveryMarkers([caches[0]!, caches[0]!]))).toBeNull();
  expect(decodeServerMessage(encodeCache({ netId: 1, kind: 'partial' }))).toEqual({
    type: 'cache',
    event: { netId: 1, kind: 'partial' },
  });
  expect(decodeClientMessage(encodeChestRequest({ action: 'storeSupplies' }))).toEqual({
    type: 'chest',
    action: 'storeSupplies',
  });
});
it('stores only building supplies and leaves overflow safely in the backpack', () => {
  const slots = emptyChest(),
    pack = { log: 12, stick: 4, bone: 2, flower: 3, berry: 5, axe: 1, guardianTrophy: 1 };
  expect(storeBuildingSupplies(slots, pack)).toEqual({ moved: 21, left: 0 });
  expect(pack).toMatchObject({ berry: 5, axe: 1, guardianTrophy: 1 });
  expect(countOf(pack, 'log')).toBe(0);
  const full: ChestSlot[] = Array.from({ length: 10 }, () => ({ item: 'log', count: 10 }));
  full[0] = { item: 'log', count: 9 };
  const overflow = { log: 3, stick: 2 };
  expect(storeBuildingSupplies(full, overflow)).toEqual({ moved: 1, left: 4 });
  expect(overflow).toEqual({ log: 2, stick: 2 });
});
