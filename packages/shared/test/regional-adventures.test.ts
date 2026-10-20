import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  emptyExpedition,
  progressExpedition,
  expeditionOffers,
  expeditionFromSaved,
  EXPEDITIONS,
  createInput,
  PlayerButton,
  STREAM,
  streamPointAt,
  LAKE,
} from '../src/index';
import { nearAdventureLake, nearMountainSpring } from '../src/sim/regional-adventures';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function outing(id: number) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.addPlayer(1, undefined, 'owner');
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, { ...saved, expedition: { ...emptyExpedition(), active: id } }, 'owner');
  return sim;
}
it('keeps old IDs, offers both regional trips from a tent, and preserves scoped progress', () => {
  expect(EXPEDITIONS.map((d) => d.id)).toEqual(Array.from({ length: 11 }, (_, i) => i));
  const offered = new Set<number>();
  for (let cycle = 0; cycle < 100; cycle++)
    for (const id of expeditionOffers('tent', { ...emptyExpedition(), cycle }, 42, 'owner'))
      offered.add(id);
  expect(offered.has(9)).toBe(true);
  expect(offered.has(10)).toBe(true);
  const state = { ...emptyExpedition(), active: 10 };
  expect(progressExpedition(state, { kind: 'fish' }, 3)).toBe(false);
  expect(progressExpedition(state, { kind: 'gather', item: 'reed' }, 6)).toBe(false);
  progressExpedition(state, { kind: 'fish', region: 'lake' }, 3);
  progressExpedition(state, { kind: 'gather', item: 'reed', region: 'lake' }, 6);
  expect(expeditionFromSaved(state).progress).toEqual([0, 6, 3]);
  const old = { ...emptyExpedition(), active: 3 };
  progressExpedition(old, { kind: 'fish', region: 'lake' });
  expect(old.progress[0]).toBe(1);
});
it('recognizes safe banks without counting the home clearing or river upstream', () => {
  const spring = streamPointAt(STREAM, 0);
  expect(nearMountainSpring(spring.x + 10, spring.z)).toBe(true);
  expect(nearMountainSpring(0, 0)).toBe(false);
  expect(nearAdventureLake(spring.x, spring.z)).toBe(false);
  expect(nearAdventureLake(0, 0)).toBe(false);
  expect(nearAdventureLake(LAKE.basin[0]!.x, LAKE.basin[0]!.z)).toBe(true);
});
it('counts actual mountain gathering and a spring arrival, and saves the journey', () => {
  const sim = outing(9);
  const patch = sim.gatherPatchesList().find((p) => p.item === 'ironOre')!;
  sim.placePlayer(
    1,
    { x: patch.x, y: sim.collision.terrain.heightAt(patch.x, patch.z), z: patch.z },
    0,
  );
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000);
  expect(sim.expeditionStateOf(1).progress).toEqual([0, 0, 1]);
  const spring = streamPointAt(STREAM, 0);
  sim.placePlayer(
    1,
    { x: spring.x + 10, y: sim.collision.terrain.heightAt(spring.x + 10, spring.z), z: spring.z },
    0,
  );
  sim.queueInput(1, createInput(2, 0, 0, 0, 0));
  sim.step(1050);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 1]);
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, saved, 'owner');
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 1]);
});
it('only counts reeds growing by the lake for its outing', () => {
  const sim = outing(10);
  const patch = sim
    .gatherPatchesList()
    .find((p) => p.item === 'reed' && nearAdventureLake(p.x, p.z))!;
  sim.placePlayer(
    1,
    { x: patch.x, y: sim.collision.terrain.heightAt(patch.x, patch.z), z: patch.z },
    0,
  );
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 1, 0]);
});
