import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  PLAINS_DENS,
  createInput,
  directionalBiteHits,
  stalkingDirection,
  ANIMAL_KINDS,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function arena(distance: number) {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  worlds.push(sim);
  const den = PLAINS_DENS.find((d) => d.kind === 'coyote')!;
  sim.addPlayer(1);
  const place = (id: number, x: number, z: number) =>
    sim.placePlayer(id, { x, z, y: sim.collision.terrain.heightAt(x, z) }, 0);
  place(1, den.x + distance, den.z);
  let tick = 0;
  const step = () => {
    sim.queueInput(1, createInput(++tick, 0, 0, 0, 0));
    sim.step(1000 + tick * 50);
  };
  return { sim, den, place, step };
}
it('stalks laterally while facing the player, then closes rather than circling forever', () => {
  const { sim, den, step } = arena(5);
  for (let tick = 0; tick < 12; tick++) step();
  const animal = sim.snapshotFor(1).find((entity) => entity.netId === den.id)!;
  expect(Math.abs(animal.z - den.z)).toBeGreaterThan(0.5);
  expect(Math.hypot(animal.vx, animal.vz)).toBeCloseTo(ANIMAL_KINDS.coyote.threat.circle.speed);
  expect(sim.healthOf(1)).toBe(100);
  for (let tick = 0; tick < 120 && sim.healthOf(1) === 100; tick++) step();
  expect(sim.healthOf(1)).toBe(72);
});
it('locks the bite direction and original victim, so a bystander cannot inherit the attack', () => {
  const { sim, den, place, step } = arena(1);
  step(); // wind-up faces player 1 on the east side.
  sim.addPlayer(2);
  place(1, den.x - 1, den.z); // evade behind the bite.
  place(2, den.x + 0.8, den.z); // another player moves into the old target's place.
  for (let tick = 0; tick < 18; tick++) step();
  expect(sim.healthOf(1)).toBe(100);
  expect(sim.healthOf(2)).toBe(100);
  const animal = sim.snapshotFor(1).find((entity) => entity.netId === den.id)!;
  expect(animal.action & 3).toBe(2); // A missed bite still gives the full recovery.
});
it('still lands a telegraphed bite on its original victim who remains in front', () => {
  const { sim, step } = arena(1);
  for (let tick = 0; tick < 15; tick++) step();
  expect(sim.healthOf(1)).toBe(100);
  for (let tick = 0; tick < 5; tick++) step();
  expect(sim.healthOf(1)).toBe(72);
});
it('keeps cone boundaries and opposing stalk directions consistent', () => {
  expect(directionalBiteHits({ x: 0, z: 0 }, 0, { x: 0, z: -1 }, 1.65, 0.4)).toBe(true);
  expect(directionalBiteHits({ x: 0, z: 0 }, 0, { x: 0, z: 1 }, 1.65, 0.4)).toBe(false);
  expect(directionalBiteHits({ x: 0, z: 0 }, 0, { x: 0, z: -2 }, 1.65, 0.4)).toBe(false);
  const left = stalkingDirection({ x: 0, z: 0 }, { x: 0, z: -3 }, 3, 1);
  const right = stalkingDirection({ x: 0, z: 0 }, { x: 0, z: -3 }, 3, -1);
  expect(left.x).toBe(-right.x);
  expect(left.z).toBe(0);
  expect(stalkingDirection({ x: 0, z: 0 }, { x: 0, z: 0 }, 3, 1)).toEqual({ x: 0, z: 0 });
});
