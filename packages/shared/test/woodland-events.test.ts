import { afterEach, expect, it } from 'vitest';
import { WorldSimulation, DEFAULT_WORLD_SEED, createInput, PlayerButton } from '../src/index';
import { DAY_LENGTH_MS } from '../src/sim/day-night';
import { calendarAt, worldStartDay } from '../src/sim/seasons';
import {
  isMushroomFlush,
  mushroomFlushSite,
  mushroomFlushSpot,
  mushroomFlushHint,
} from '../src/sim/woodland-events';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function world() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  return sim;
}
function setDay(sim: WorldSimulation, day: number) {
  sim.setCalendarShift((24 + day - worldStartDay(DEFAULT_WORLD_SEED)) * DAY_LENGTH_MS);
}
it('offers a deterministic shared flush on only four damp-season days each year', () => {
  const sim = world();
  const active: number[] = [];
  for (let day = 0; day < 24; day++) {
    const cal = calendarAt(
      DEFAULT_WORLD_SEED,
      (24 + day - worldStartDay(DEFAULT_WORLD_SEED)) * DAY_LENGTH_MS,
    );
    const site = mushroomFlushSite(DEFAULT_WORLD_SEED, cal, sim.discoverySites);
    if (site) active.push(day);
    expect(mushroomFlushSite(DEFAULT_WORLD_SEED, cal, sim.discoverySites)).toEqual(site);
  }
  expect(active).toEqual([1, 4, 13, 16]);
});
it('never falls back to blocked ground and only hints near remaining event mushrooms', () => {
  expect(mushroomFlushSpot(7, 2, 240, { x: 0, z: 0 }, () => false)).toBeNull();
  const spot = mushroomFlushSpot(7, 2, 240, { x: 0, z: 0 }, () => true)!;
  expect(Math.hypot(spot.x, spot.z)).toBeGreaterThanOrEqual(4);
  const patches = [{ id: 240, item: 'mushroom' as const, ...spot, remaining: 3 }];
  expect(mushroomFlushHint(patches, spot.x, spot.z)).toContain('mushroom flush');
  expect(mushroomFlushHint(patches, 100, 100)).toBeNull();
  expect(mushroomFlushHint([{ ...patches[0]!, remaining: 0 }], spot.x, spot.z)).toBeNull();
});
it('persists harvested clusters, refuses normal regrowth, expires and returns on the next flush', () => {
  const sim = world();
  setDay(sim, 1);
  sim.regrowPatches(1000);
  const patches = sim.gatherPatchesList().filter((p) => isMushroomFlush(p.id));
  expect(patches.filter((p) => p.remaining > 0).length).toBeGreaterThan(0);
  expect(new Set(sim.gatherPatchesList().map((p) => p.id)).size).toBe(
    sim.gatherPatchesList().length,
  );
  const picked = patches.find((p) => p.remaining > 0)!;
  const saved = sim.persistedPatch(picked.id);
  expect(saved).not.toBeNull();
  sim.restorePatches([{ ...saved!, remaining: 0, emptiedAtMs: 1000 }]);
  sim.regrowPatches(999999999);
  expect(sim.gatherPatchesList().find((p) => p.id === picked.id)?.remaining).toBe(0);
  const restored = world();
  setDay(restored, 1);
  restored.restorePatches(sim.gatherPatchesList().map((p) => sim.persistedPatch(p.id)!));
  restored.regrowPatches(999999999);
  expect(restored.gatherPatchesList().filter((p) => isMushroomFlush(p.id))).toEqual(
    sim.gatherPatchesList().filter((p) => isMushroomFlush(p.id)),
  );
  setDay(restored, 2);
  restored.regrowPatches(999999999);
  expect(
    restored
      .gatherPatchesList()
      .filter((p) => isMushroomFlush(p.id))
      .every((p) => p.remaining === 0),
  ).toBe(true);
  setDay(restored, 4);
  restored.regrowPatches(999999999);
  expect(restored.gatherPatchesList().some((p) => isMushroomFlush(p.id) && p.remaining > 0)).toBe(
    true,
  );
});

it('lets a player harvest event mushrooms through the normal authoritative interaction', () => {
  const sim = world();
  setDay(sim, 1);
  sim.regrowPatches(1000);
  sim.addPlayer(1);
  const patch = sim.gatherPatchesList().find((p) => isMushroomFlush(p.id) && p.remaining > 0)!;
  sim.placePlayer(
    1,
    { x: patch.x, y: sim.collision.terrain.heightAt(patch.x, patch.z), z: patch.z },
    0,
  );
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1050);
  expect(sim.inventoryOf(1).mushroom).toBeGreaterThan(0);
  expect(sim.gatherPatchesList().find((p) => p.id === patch.id)?.remaining).toBe(2);
});
