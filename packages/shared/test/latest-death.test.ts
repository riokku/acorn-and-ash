import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  createInput,
  PlayerButton,
  countOf,
  type BuriedCache,
} from '../src/index';

const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world() {
  const sim = new WorldSimulation({
    seed: 123,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  return sim;
}
function knockOut(sim: WorldSimulation, id = 1) {
  // Settle a lethal enemy blow through the same damage path used by raids.
  (
    sim as unknown as {
      raiderStrikesPlayer(id: number, damage: number, tick: number): void;
    }
  ).raiderStrikesPlayer(id, 1000, sim.tick);
  expect(sim.drainHealthEvents().at(-1)?.knockedOut).toBe(true);
}
const cache = (id: number, ownerPlayerKey = 'owner'): BuriedCache => ({
  id,
  ownerPlayerKey,
  x: 0,
  z: 10,
  items: [{ item: 'log', count: 4 }],
});

it('replaces the previous death after reconnect and leaves another player and treasure alone', () => {
  const sim = world();
  Object.assign(sim.inventoryOf(1), { log: 8 });
  knockOut(sim);
  const oldId = sim.buriedCachesList()[0]!.id;
  expect(countOf(sim.inventoryOf(1), 'log')).toBe(4);
  sim.drainCacheEvents();
  sim.restoreBuriedCaches([cache(50, 'visitor')]);
  sim.initializeTreasures([{ id: 1, x: 15, z: 15, items: [{ item: 'log', count: 3 }] }]);
  const treasure = sim.savedTreasures();
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(7, { ...saved, netId: 7 }, 'owner');
  sim.placePlayer(7, { x: 0, y: 0, z: 10 }, 0);
  knockOut(sim, 7);
  const own = sim.buriedCachesList().filter((entry) => entry.ownerNetId === 7);
  expect(own).toHaveLength(1);
  expect(own[0]!.id).toBeGreaterThan(50);
  expect(sim.buriedCachesList().some((entry) => entry.id === oldId)).toBe(false);
  expect(sim.buriedCachesList().some((entry) => entry.id === 50)).toBe(true);
  expect(sim.savedTreasures()).toEqual(treasure);
  expect(sim.drainCacheEvents()).toEqual([
    { netId: 7, kind: 'lost', cacheId: oldId },
    {
      netId: 7,
      kind: 'buried',
      cache: expect.objectContaining({ items: [{ item: 'log', count: 2 }] }),
    },
  ]);
});

it('loses the old stash even when the next death has nothing to bury', () => {
  const sim = world();
  sim.restoreBuriedCaches([cache(41)]);
  knockOut(sim);
  expect(sim.buriedCachesList()).toEqual([]);
  expect(sim.drainCacheEvents()).toEqual([{ netId: 1, kind: 'lost', cacheId: 41 }]);
});

it('loses unrecovered leftovers on the next death', () => {
  const sim = world();
  sim.restoreBuriedCaches([cache(41)]);
  Object.assign(sim.inventoryOf(1), { log: 58 });
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(0);
  expect(sim.drainCacheEvents()).toEqual([
    {
      netId: 1,
      kind: 'partial',
      cache: expect.objectContaining({ items: [{ item: 'log', count: 2 }] }),
    },
  ]);
  knockOut(sim);
  expect(sim.buriedCachesList()).toHaveLength(1);
  expect(sim.buriedCachesList()[0]!.id).not.toBe(41);
  expect(sim.drainCacheEvents()).toEqual([
    { netId: 1, kind: 'lost', cacheId: 41 },
    {
      netId: 1,
      kind: 'buried',
      cache: expect.objectContaining({ items: [{ item: 'log', count: 30 }] }),
    },
  ]);
});

it('restores only the newest cache per owner regardless of storage order', () => {
  const sim = world();
  expect(
    sim
      .restoreBuriedCaches([cache(42), cache(6, 'visitor'), cache(41), cache(5, 'visitor')])
      .sort(),
  ).toEqual([41, 5]);
  expect(
    sim
      .buriedCachesList()
      .map((entry) => entry.id)
      .sort(),
  ).toEqual([42, 6]);
  // Repeated restores cannot revive an older cache.
  expect(sim.restoreBuriedCaches([cache(40)])).toEqual([40]);
  knockOut(sim);
  expect(sim.buriedCachesList().map((entry) => entry.id)).toEqual([6]);
});
