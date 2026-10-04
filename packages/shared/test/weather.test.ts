import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  forestWeather,
  weatherPlan,
  WEATHER_CYCLE_MS,
  createInput,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function world() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, hungerEmptyAfterSeconds: Infinity });
  sims.push(sim);
  return sim;
}
it('shares a gentle, deterministic forecast with bounded rain and occasional short storms', () => {
  let storms = 0;
  for (let cycle = 0; cycle < 80; cycle++) {
    const p = weatherPlan(DEFAULT_WORLD_SEED, cycle);
    expect(p.rainEnds - p.rainStarts).toBeGreaterThanOrEqual(180_000);
    expect(p.rainEnds - p.rainStarts).toBeLessThanOrEqual(300_000);
    expect(forestWeather(DEFAULT_WORLD_SEED, cycle * WEATHER_CYCLE_MS + 100_000).kind).toBe(
      'clear',
    );
    expect(
      forestWeather(DEFAULT_WORLD_SEED, cycle * WEATHER_CYCLE_MS + p.rainStarts - 1000).kind,
    ).toBe('drizzle');
    expect(
      forestWeather(DEFAULT_WORLD_SEED, cycle * WEATHER_CYCLE_MS + p.rainStarts + 1000).kind,
    ).toBe('rain');
    if (p.storm) {
      storms++;
      expect(p.stormMs).toBeGreaterThanOrEqual(60_000);
      expect(p.stormMs).toBeLessThanOrEqual(120_000);
    }
  }
  expect(storms).toBeGreaterThan(5);
  expect(storms).toBeLessThan(35);
});
it('keeps rain-fed mushrooms abundant briefly after rainfall', () => {
  const p = weatherPlan(DEFAULT_WORLD_SEED, 12),
    end = 12 * WEATHER_CYCLE_MS + p.rainEnds;
  expect(forestWeather(DEFAULT_WORLD_SEED, end + 120_000).mushroomsAbundant).toBe(true);
  expect(forestWeather(DEFAULT_WORLD_SEED, end + 360_001).mushroomsAbundant).toBe(false);
});
it('gathers a shared rain-fed cluster once, respecting limited backpack capacity', () => {
  const sim = world();
  sim.addPlayer(1, undefined, 'forager');
  sim.addPlayer(2, undefined, 'friend');
  const patch = sim.gatherPatchesList().find((p) => p.item === 'mushroom')!;
  const now = WEATHER_CYCLE_MS * 20 + weatherPlan(DEFAULT_WORLD_SEED, 20).rainStarts + 1000;
  sim.placePlayer(1, { x: patch.x, y: 0, z: patch.z }, 0);
  sim.requestLoot(1, { kind: 'patch', id: patch.id });
  sim.queueInput(1, createInput(1, 0, 0, 0, 0));
  sim.step(now);
  expect(sim.inventoryOf(1).mushroom).toBe(2);
  expect(sim.gatherPatchesList().find((p) => p.id === patch.id)?.remaining).toBe(
    patch.remaining - 1,
  );
  expect(sim.drainCollectionEvents()[0]?.count).toBe(2);
  Object.assign(sim.inventoryOf(2), { log: 50, mushroom: 7 }); // Five log slots and one nearly full mushroom stack.
  sim.placePlayer(2, { x: patch.x, y: 0, z: patch.z }, 0);
  sim.requestLoot(2, { kind: 'patch', id: patch.id });
  sim.step(now + 50);
  expect(sim.inventoryOf(2).mushroom).toBe(8);
  expect(sim.drainCollectionEvents()[0]?.count).toBe(1);
});
it('saves the storm cursor and creates bounded shared windfalls without replay after restart', () => {
  const sim = world();
  let cycle = 1;
  while (!weatherPlan(DEFAULT_WORLD_SEED, cycle - 1).storm) cycle++;
  sim.restoreWeatherCycle(cycle - 1);
  sim.updateWeather(cycle * WEATHER_CYCLE_MS + 1000);
  const piles = sim.droppedPilesList();
  expect(piles.length).toBeGreaterThan(0);
  expect(piles.length).toBeLessThanOrEqual(6);
  expect(piles.every((p) => p.item === 'log' || p.item === 'stick')).toBe(true);
  expect(sim.drainWeatherCycleChange()).toBe(cycle);
  sim.updateWeather((cycle - 1) * WEATHER_CYCLE_MS);
  sim.updateWeather(cycle * WEATHER_CYCLE_MS + 1100);
  expect(sim.droppedPilesList()).toEqual(piles);
  expect(sim.drainWeatherCycleChange()).toBeNull();
  const saved = piles.map((p) => sim.persistedPile(p.id)!);
  const returned = world();
  returned.restoreDroppedPiles(saved, cycle * WEATHER_CYCLE_MS + 1100);
  returned.restoreWeatherCycle(cycle);
  returned.updateWeather(cycle * WEATHER_CYCLE_MS + 1200);
  expect(returned.droppedPilesList()).toEqual(piles);
  expect(returned.drainWeatherCycleChange()).toBeNull();
});
it('does not stockpile missed storms or create retrospective loot for new worlds', () => {
  const sim = world();
  sim.updateWeather(WEATHER_CYCLE_MS * 500);
  expect(sim.droppedPilesList()).toEqual([]);
  sim.restoreWeatherCycle(1);
  sim.updateWeather(WEATHER_CYCLE_MS * 1000);
  expect(sim.droppedPilesList().length).toBeLessThanOrEqual(6);
});
