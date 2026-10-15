import { afterEach, expect, it } from 'vitest';
import {
  BASIC_CLOTHING,
  characterStats,
  creatureClothingDrop,
  gearSlotsOf,
  itemFromIndex,
  itemIndex,
  ANIMAL_DENS,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createInput,
  PlayerButton,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));

it('occasionally drops each clothing kind from wildlife, skeletons and bosses deterministically', () => {
  for (const [source, kind, low, high] of [
    ['animal', 'rabbit', 0.1, 0.2],
    ['animal', 'maskedRaccoon', 0.25, 0.35],
    ['raider', 'minion', 0.25, 0.35],
    ['raider', 'sentinel', 0.45, 0.55],
  ] as const) {
    const rolls = Array.from({ length: 2000 }, (_, tick) =>
      creatureClothingDrop(123, source, kind, 11, tick),
    );
    expect(rolls).toEqual(
      Array.from({ length: 2000 }, (_, tick) => creatureClothingDrop(123, source, kind, 11, tick)),
    );
    expect(rolls.filter((item) => item !== null).length / rolls.length).toBeGreaterThan(low);
    expect(rolls.filter((item) => item !== null).length / rolls.length).toBeLessThan(high);
    expect(new Set(rolls.filter((item) => item !== null))).toEqual(new Set(BASIC_CLOTHING));
  }
  expect(creatureClothingDrop(123, 'animal', 'curiousRaccoon', 11, 0)).toBeNull();
});

it('keeps old item indices and equips a complete modest starter set with warmth and protection', () => {
  expect(itemIndex('winterJacket')).toBe(46);
  expect(BASIC_CLOTHING.map((item) => itemFromIndex(itemIndex(item)))).toEqual(BASIC_CLOTHING);
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, forestEncounters: false });
  worlds.push(sim);
  sim.addPlayer(1);
  sim.giveTestGear(1, BASIC_CLOTHING);
  for (const item of BASIC_CLOTHING)
    expect(sim.wearGear(1, item, gearSlotsOf(item)[0]!).ok).toBe(true);
  expect(characterStats(sim.wornOf(1))).toMatchObject({ protection: 5, warmth: 30, vitality: 100 });
  expect(sim.wearGear(1, 'linenShirt', 'feet').ok).toBe(false);
});

it("leaves an actual defeated creature's clothing on the ground even with a full pack, only once", () => {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.addPlayer(1);
  const den = ANIMAL_DENS.find((animal) => animal.kind === 'rabbit')!;
  // The combat method is called only after the server validates an impact. This isolates the reward boundary.
  const internal = sim as unknown as {
    players: Map<number, unknown>;
    catchAnimal(runtime: unknown, id: number, charged: boolean): void;
  };
  const rewardTick = Array.from({ length: 1000 }, (_, tick) => tick).find(
    (tick) => creatureClothingDrop(sim.seed, 'animal', den.kind, den.id, tick) !== null,
  )!;
  for (let step = 0; step < rewardTick; step++) sim.step(step * 50);
  Object.assign(sim.inventoryOf(1), { axe: 1, rod: 1, shovel: 1, torch: 1, log: 20 });
  const before = sim.droppedPilesList().length;
  internal.catchAnimal(internal.players.get(1), den.id, true);
  const pile = sim
    .droppedPilesList()
    .find((pile) => BASIC_CLOTHING.includes(pile.item as (typeof BASIC_CLOTHING)[number]));
  expect(pile).toBeDefined();
  expect(pile?.count).toBe(1);
  expect(sim.droppedPilesList()).toHaveLength(before + 1);
  internal.catchAnimal(internal.players.get(1), den.id, true);
  expect(sim.droppedPilesList()).toHaveLength(before + 1);
  const at = pile!;
  delete sim.inventoryOf(1).log;
  sim.placePlayer(1, { x: at.x, y: sim.collision.terrain.heightAt(at.x, at.z), z: at.z }, 0);
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000);
  expect(sim.inventoryOf(1)[at.item]).toBe(1);
});
