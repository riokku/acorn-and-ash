import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, PICKUP_REACH } from '../src/constants';
import { ITEM_KINDS } from '../src/data/items';
import { createFlatTerrain } from '../src/world/terrain';
import { createInput, PlayerButton } from '../src/sim/player';
import { WorldSimulation } from '../src/sim/world-sim';
import {
  TREASURE_COUNT,
  createTreasures,
  treasureLoot,
  treasuresFromSaved,
  type BuriedTreasure,
} from '../src/sim/treasure';
import { decodeServerMessage, encodeCache, encodeTreasure } from '../src/net/protocol';

const worlds: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of worlds.splice(0)) sim.dispose();
});
const mound: BuriedTreasure = { id: 1, x: 0, z: 10, items: [{ item: 'log', count: 4 }] };
function world(held: 'shovel' | 'axe' = 'shovel', logs = 0) {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    terrain: createFlatTerrain(),
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.initializeTreasures([mound]);
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 10,
    facingYaw: 0,
    hunger: 100,
    equippedItem: held,
    items: [
      { item: held, count: 1 },
      { item: 'log', count: logs },
    ],
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  return sim;
}
function interact(sim: WorldSimulation, id = 1) {
  sim.queueInput(id, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000);
}

describe('buried treasure', () => {
  it('seeds varied, spaced mounds deterministically and never falls back into blocked ground', () => {
    const a = createTreasures(123, (x) => x > 0);
    expect(a).toHaveLength(TREASURE_COUNT);
    expect(a).toEqual(createTreasures(123, (x) => x > 0));
    expect(a).not.toEqual(createTreasures(456, (x) => x > 0));
    expect(createTreasures(123, () => false)).toEqual([]);
    for (const spot of a) {
      expect(spot.x).toBeGreaterThan(0);
      expect(Math.hypot(spot.x, spot.z)).toBeGreaterThanOrEqual(18);
      for (const other of a)
        if (spot !== other)
          expect(Math.hypot(spot.x - other.x, spot.z - other.z)).toBeGreaterThanOrEqual(16);
    }
    const allLoot = Array.from({ length: 200 }, (_, id) => treasureLoot(123, id)).flat();
    expect(new Set(allLoot.map((entry) => entry.item)).size).toBeGreaterThan(12);
    expect(allLoot.every((entry) => ITEM_KINDS[entry.item] !== undefined && entry.count > 0)).toBe(
      true,
    );
  });

  it('requires the equipped shovel, then grants loot once without carving terrain', () => {
    const sim = world('axe');
    interact(sim);
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    expect(sim.treasureSpots()).toHaveLength(1);
    Object.assign(sim.inventoryOf(1), { shovel: 1 });
    expect(sim.useItem(1, 'shovel')).toBe(true);
    sim.queueInput(1, createInput(2, 0, 0, 0, PlayerButton.Interact));
    sim.step(1050);
    expect(sim.inventoryOf(1).log).toBe(4);
    expect(sim.treasureSpots()).toEqual([]);
    expect(sim.digsList()).toEqual([]);
  });

  it('lets any player with a shovel dig it, without granting private recovery markers', () => {
    const sim = world();
    expect(sim.buriedCachesList()).toEqual([]);
    interact(sim);
    expect(sim.inventoryOf(1).log).toBe(4);
    expect(sim.treasureSpots()).toEqual([]);
    expect(sim.drainTreasureEvents()).toEqual([{ netId: 1, kind: 'treasure' }]);
    expect(sim.digsList()).toEqual([]);
    sim.queueInput(1, createInput(2, 0, 0, 0, PlayerButton.Interact));
    sim.step(1050);
    expect(sim.inventoryOf(1).log).toBe(4);
  });

  it('keeps leftovers across save/load, including a completely collected world', () => {
    const sim = world('shovel', 18);
    // Five occupied stacks leave only the existing log stack available.
    Object.assign(sim.inventoryOf(1), { axe: 1, rod: 1, torch: 1 });
    interact(sim);
    expect(sim.inventoryOf(1).log).toBe(20);
    expect(sim.savedTreasures()[0]?.items).toEqual([{ item: 'log', count: 2 }]);
    expect(sim.drainTreasureEvents()[0]?.kind).toBe('treasurePartial');
    const saved = treasuresFromSaved(JSON.parse(JSON.stringify(sim.savedTreasures())))!;
    sim.initializeTreasures(saved);
    expect(sim.savedTreasures()[0]?.items[0]?.count).toBe(2);
    sim.initializeTreasures([]);
    expect(sim.treasureSpots()).toEqual([]);
    expect(treasuresFromSaved([])).toEqual([]);
    expect(treasuresFromSaved('bad')).toBeNull();
    expect(
      treasuresFromSaved([
        { ...mound, x: NaN },
        { ...mound, items: [{ item: 'not-an-item', count: 1 }] },
      ]),
    ).toEqual([]);
  });

  it('refuses a full pack and out-of-reach or underground attempts without losing anything', () => {
    const sim = world('shovel', 20);
    Object.assign(sim.inventoryOf(1), { axe: 1, rod: 1, torch: 1 });
    interact(sim);
    expect(sim.savedTreasures()).toEqual([mound]);
    expect(sim.drainTreasureEvents()).toEqual([]);
    expect(sim.drainPickupRefusals()).toHaveLength(1);
    for (const position of [
      { x: 0, y: 0, z: 10 + PICKUP_REACH + 1 },
      { x: 0, y: -5, z: 10 },
    ]) {
      sim.placePlayer(1, position, 0);
      interact(sim);
      expect(sim.savedTreasures()).toEqual([mound]);
    }
  });

  it('does not duplicate loot when two players dig the same mound in one tick', () => {
    const sim = world();
    sim.addPlayer(2, {
      netId: 2,
      x: 0,
      y: 0,
      z: 10,
      facingYaw: 0,
      hunger: 100,
      equippedItem: 'shovel',
      items: [{ item: 'shovel', count: 1 }],
    });
    sim.placePlayer(2, { x: 0, y: 0, z: 10 }, 0);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.queueInput(2, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(1000);
    expect((sim.inventoryOf(1).log ?? 0) + (sim.inventoryOf(2).log ?? 0)).toBe(4);
    expect(sim.drainTreasureEvents()).toHaveLength(1);
  });

  it('places initial mounds on usable terrain in a real forest', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, forestEncounters: false });
    worlds.push(sim);
    const spots = sim.initializeTreasures(null);
    expect(spots).toHaveLength(TREASURE_COUNT);
    const terrain = sim.collision.terrain;
    for (const spot of spots) {
      const y = terrain.heightAt(spot.x, spot.z);
      expect(Math.abs(terrain.heightAt(spot.x + 1, spot.z) - y)).toBeLessThan(0.4);
    }
  });
});

describe('treasure wire format', () => {
  it('sends positions without loot and round-trips private feedback', () => {
    expect(decodeServerMessage(encodeTreasure([mound]))).toEqual({
      type: 'treasure',
      spots: [{ id: 1, x: 0, z: 10 }],
    });
    for (const kind of ['treasure', 'treasurePartial'] as const)
      expect(decodeServerMessage(encodeCache({ netId: 7, kind }))).toEqual({
        type: 'cache',
        event: { netId: 7, kind },
      });
  });
  it('rejects truncated, duplicate, invalid and oversized lists', () => {
    const encoded = encodeTreasure([mound]);
    expect(decodeServerMessage(encoded.slice(0, -1))).toBeNull();
    expect(decodeServerMessage(encodeTreasure([mound, mound]))).toBeNull();
    const bad = encoded.slice(0);
    new DataView(bad).setFloat32(3, NaN, true);
    expect(decodeServerMessage(bad)).toBeNull();
    const tooMany = encoded.slice(0);
    new DataView(tooMany).setUint8(1, TREASURE_COUNT + 1);
    expect(decodeServerMessage(tooMany)).toBeNull();
  });
});
