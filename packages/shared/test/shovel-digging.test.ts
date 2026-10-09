import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, HUNGER_MAX, TICK_MILLISECONDS } from '../src/constants';
import { countOf } from '../src/sim/inventory';
import { PlayerButton, createInput } from '../src/sim/player';
import { DIG_MAX_COUNT, digRefusal, digYield, inHomeClearing, planDig } from '../src/sim/digging';
import { WorldSimulation, type PersistedPlayer } from '../src/sim/world-sim';
import { DugGrid } from '../src/world/digging';
import { createWildernessTerrain } from '../src/world/terrain';

let clockMs = 0;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);
const built: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of built.splice(0)) sim.dispose();
});

function createWorld(): WorldSimulation {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  built.push(sim);
  return sim;
}

const withShovel = (netId: number): PersistedPlayer => ({
  netId,
  x: 0,
  y: 0,
  z: 0,
  facingYaw: 0,
  items: [
    { item: 'bag', count: 1 },
    { item: 'shovel', count: 1 },
  ],
  hunger: HUNGER_MAX,
});

/** A spot where the ground rises steeply to the north (-Z, which aim yaw 0 faces), outside the clearing. */
function findHillside(sim: WorldSimulation): { x: number; z: number } {
  const terrain = sim.collision.terrain;
  for (let x = -280; x < -60; x += 3) {
    for (let z = 280; z > 60; z -= 3) {
      if (inHomeClearing(x, z)) continue;
      const here = terrain.heightAt(x, z);
      if (here < 3 || terrain.heightAt(x, z - 1.2) - here < 0.9) continue;
      if (terrain.heightAt(x, z - 1.2) - here > 1.8) continue;
      return { x, z };
    }
  }
  throw new Error('no hillside found');
}

/** Somewhere well away from the clearing where the ground is nearly level. */
function findFlatSpot(terrain: ReturnType<typeof createWildernessTerrain>): {
  x: number;
  z: number;
} {
  for (let x = -200; x > -460; x -= 4)
    for (let z = 200; z < 460; z += 4) {
      const h = terrain.heightAt(x, z);
      if (h > 0.5 && Math.abs(terrain.heightAt(x + 2, z) - h) < 0.15) return { x, z };
    }
  throw new Error('no flat ground found');
}

describe('digging with the shovel', () => {
  it('carves a slab ahead and tells everybody', () => {
    const sim = createWorld();
    sim.addPlayer(1, withShovel(1));
    const spot = findHillside(sim);
    sim.placePlayer(
      1,
      { x: spot.x, y: sim.collision.terrain.heightAt(spot.x, spot.z), z: spot.z },
      0,
    );
    for (let seq = 1; seq <= 40 && sim.digsList().length === 0; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.digsList().length).toBe(1);
    expect(sim.drainDigNews()).toHaveLength(1);
    expect(sim.drainDigNews()).toHaveLength(0);
    sim.drainCollectionEvents();
  });

  it('still digs a first scoop on level ground', () => {
    const sim = createWorld();
    sim.addPlayer(1, withShovel(1));
    const terrain = sim.collision.terrain;
    let flat: { x: number; z: number } | null = null;
    for (let x = -200; x > -460 && flat === null; x -= 4) {
      for (let z = 200; z < 460 && flat === null; z += 4) {
        const h = terrain.heightAt(x, z);
        const level = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].every(([dx, dz]) => Math.abs(terrain.heightAt(x + dx!, z + dz!) - h) < 0.15);
        if (level && h > 0.5 && !inHomeClearing(x, z)) flat = { x, z };
      }
    }
    expect(flat).not.toBeNull();
    const spot = flat!;
    sim.placePlayer(1, { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z }, 0);
    for (let seq = 1; seq <= 40 && sim.digsList().length === 0; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.digsList().length).toBe(1);
  });

  it('replays saved digs into the same ground', () => {
    const a = createWorld();
    a.addPlayer(1, withShovel(1));
    const spot = findHillside(a);
    a.placePlayer(1, { x: spot.x, y: a.collision.terrain.heightAt(spot.x, spot.z), z: spot.z }, 0);
    for (let seq = 1; seq <= 120; seq++) {
      a.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      a.step(tickClock());
    }
    const b = createWorld();
    b.restoreDigs(a.digsList());
    expect(b.digsList()).toEqual(a.digsList());
    expect(a.digsList().length).toBeGreaterThan(0);
  });

  it('digs with a shovel worn in the main hand', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withShovel(1),
      items: [{ item: 'bag', count: 1 }],
      worn: [{ slot: 'mainHand', item: 'shovel' }],
    });
    const spot = findHillside(sim);
    sim.placePlayer(
      1,
      { x: spot.x, y: sim.collision.terrain.heightAt(spot.x, spot.z), z: spot.z },
      0,
    );
    for (let seq = 1; seq <= 40 && sim.digsList().length === 0; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.digsList()).toHaveLength(1);
  });

  it('tells the digger why when the home clearing refuses', () => {
    const sim = createWorld();
    sim.addPlayer(1, withShovel(1));
    sim.placePlayer(1, { x: 0, y: sim.collision.terrain.heightAt(0, 0), z: 0 }, 0);
    for (let seq = 1; seq <= 30; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, seq === 1 ? PlayerButton.Swing : 0));
      sim.step(tickClock());
    }
    expect(sim.digsList()).toHaveLength(0);
    expect(sim.drainDigRefusals()).toEqual([{ netId: 1, reason: 'home' }]);
  });

  it('still digs with a full pack, losing only whatever it turns up', () => {
    const sim = createWorld();
    sim.addPlayer(1, {
      ...withShovel(1),
      items: [
        { item: 'bag', count: 1 },
        { item: 'shovel', count: 1 },
        { item: 'stone', count: 500 },
      ],
    });
    const spot = findHillside(sim);
    sim.placePlayer(
      1,
      { x: spot.x, y: sim.collision.terrain.heightAt(spot.x, spot.z), z: spot.z },
      0,
    );
    const before = countOf(sim.inventoryOf(1), 'stone');
    for (let seq = 1; seq <= 40 && sim.digsList().length === 0; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.digsList()).toHaveLength(1);
    expect(countOf(sim.inventoryOf(1), 'stone')).toBe(before);
  });

  it('digs overhead, in the square you stand in, when aimed up', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const grid = new DugGrid(terrain);
    const spot = findFlatSpot(terrain);
    const feet = { x: spot.x + 0.5, y: terrain.heightAt(spot.x, spot.z), z: spot.z + 0.5 };
    // A tunnel two cubes tall right under the feet: the roof is next.
    const level = planDig({ ...feet, y: feet.y - 3 }, 0, false, grid);
    grid.apply(level);
    const roof = planDig({ ...feet, y: feet.y - 3 }, 0, false, grid, true);
    expect(roof.ix).toBe(Math.floor(feet.x) * 2);
    expect(roof.iz).toBe(Math.floor(feet.z) * 2);
    expect(roof.iy).toBeGreaterThan(level.iy);
    expect(grid.solidCubes(roof).length).toBeGreaterThan(0);
  });

  it('digs nothing without the shovel in hand', () => {
    const sim = createWorld();
    sim.addPlayer(1, { ...withShovel(1), items: [{ item: 'bag', count: 1 }] });
    const spot = findHillside(sim);
    sim.placePlayer(
      1,
      { x: spot.x, y: sim.collision.terrain.heightAt(spot.x, spot.z), z: spot.z },
      0,
    );
    for (let seq = 1; seq <= 60; seq++) {
      sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Swing));
      sim.step(tickClock());
    }
    expect(sim.digsList()).toHaveLength(0);
  });
});

describe('where digging is allowed', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const grid = new DugGrid(terrain);
  const none = () => false;

  it('refuses inside the home clearing', () => {
    const dig = planDig({ x: 0, y: 0, z: 0 }, 0, true, grid);
    expect(digRefusal(dig, grid, terrain, none, [])).toBe('home');
  });

  it('refuses near water and near built pieces', () => {
    const dig = planDig({ x: -150, y: 5, z: 150 }, 0, true, grid);
    expect(digRefusal(dig, grid, terrain, () => true, [])).toBe('water');
    expect(digRefusal(dig, grid, terrain, none, [{ x: -150, z: 149 }])).toBe('built');
  });

  it('refuses to go deeper than the limit and past the world cap', () => {
    const deep = { ix: -300, iy: -100, iz: 300, dir: 0 as const };
    expect(digRefusal(deep, grid, terrain, none, [])).toBe('deep');
    const crowded = { digs: { length: DIG_MAX_COUNT } } as unknown as DugGrid;
    expect(digRefusal(deep, crowded, terrain, none, [])).toBe('full');
  });

  it('turns up something on only a few digs in a hundred, the same for the same dig', () => {
    let finds = 0;
    const tries = 5000;
    for (let i = 0; i < tries; i++) {
      const dig = { ix: -300 + i, iy: 4, iz: 300, dir: 4 as const };
      const found = digYield(7, dig, 8);
      expect(digYield(7, dig, 8)).toEqual(found);
      if (found.length > 0) finds++;
    }
    expect(finds / tries).toBeGreaterThan(0.02);
    expect(finds / tries).toBeLessThan(0.05);
  });
});
