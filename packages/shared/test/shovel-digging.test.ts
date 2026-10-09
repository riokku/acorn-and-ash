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

describe('digging with the shovel', () => {
  it('carves a slab ahead, keeps the stone and tells everybody', () => {
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
    expect(countOf(sim.inventoryOf(1), 'stone')).toBeGreaterThan(0);
    expect(sim.drainDigNews()).toHaveLength(1);
    expect(sim.drainDigNews()).toHaveLength(0);
    sim.drainCollectionEvents();
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
    const dig = planDig({ x: 0, y: 0, z: 0 }, 0, true);
    expect(digRefusal(dig, grid, terrain, none, [])).toBe('home');
  });

  it('refuses near water and near built pieces', () => {
    const dig = planDig({ x: -150, y: 5, z: 150 }, 0, true);
    expect(digRefusal(dig, grid, terrain, () => true, [])).toBe('water');
    expect(digRefusal(dig, grid, terrain, none, [{ x: -150, z: 149 }])).toBe('built');
  });

  it('refuses to go deeper than the limit and past the world cap', () => {
    const deep = { ix: -300, iy: -100, iz: 300, dir: 0 as const };
    expect(digRefusal(deep, grid, terrain, none, [])).toBe('deep');
    const crowded = { digs: { length: DIG_MAX_COUNT } } as unknown as DugGrid;
    expect(digRefusal(deep, crowded, terrain, none, [])).toBe('full');
  });

  it('turns up stone every time and the same things for the same dig', () => {
    const dig = { ix: -300, iy: 4, iz: 300, dir: 0 as const };
    const first = digYield(7, dig, 24, 8);
    expect(first[0]).toEqual({ item: 'stone', count: 3 });
    expect(digYield(7, dig, 24, 8)).toEqual(first);
    expect(digYield(7, dig, 2, 8)[0]).toEqual({ item: 'stone', count: 1 });
  });
});
