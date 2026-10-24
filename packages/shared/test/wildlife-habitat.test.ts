import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createFlatTerrain,
  wildlifeCover,
  wildlifePauseMs,
  fleePastCover,
  cylinder,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world(flat = false) {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
    ...(flat ? { terrain: createFlatTerrain() } : {}),
  });
  worlds.push(sim);
  sim.addPlayer(1);
  return sim;
}
it('chooses a reachable edge of existing rock, never inside it or at a blocked fallback', () => {
  const rocks = [{ x: 3, z: 0, radius: 1 }];
  const at = wildlifeCover({ x: 0, z: 0 }, rocks, () => true)!;
  expect(at.x).toBeCloseTo(1.25);
  expect(Math.hypot(at.x - 3, at.z)).toBeCloseTo(1.75);
  expect(wildlifeCover({ x: 0, z: 0 }, rocks, () => false)).toBeNull();
  expect(wildlifeCover({ x: 0, z: 0 }, [{ x: 30, z: 0, radius: 2 }], () => true)).toBeNull();
});
it('keeps cover-biased flight away from danger and pauses deterministic by identity', () => {
  const away = { x: 1, z: 0 };
  expect(fleePastCover({ x: 0, z: 0 }, away, { x: -4, z: 0 })).toBe(away);
  const escape = fleePastCover({ x: 0, z: 0 }, away, { x: 4, z: 3 });
  expect(escape.x).toBeGreaterThan(0.9);
  expect(escape.z).toBeGreaterThan(0);
  const pause = wildlifePauseMs(42, 1001, 3, [2, 4]);
  expect(pause).toBeGreaterThanOrEqual(2000);
  expect(pause).toBeLessThanOrEqual(4000);
  expect(wildlifePauseMs(42, 1001, 3, [2, 4])).toBe(pause);
  expect(wildlifePauseMs(42, 1002, 3, [2, 4])).not.toBe(pause);
});
it('takes calm foraging pauses, then immediately reacts to an approaching player', () => {
  const sim = world();
  let moved = false,
    stationary = 0;
  for (let tick = 0; tick < 600; tick++) {
    sim.step(1000 + tick * 50);
    const rabbit = sim.snapshotFor(1).find((entity) => entity.netId === 1001)!;
    const speed = Math.hypot(rabbit.vx, rabbit.vz);
    if (speed > 0.2) moved = true;
    if (moved && speed < 0.01) stationary++;
  }
  expect(moved).toBe(true);
  expect(stationary).toBeGreaterThan(20);
  const rabbit = sim.snapshotFor(1).find((entity) => entity.netId === 1001)!;
  sim.placePlayer(1, { x: rabbit.x + 1, z: rabbit.z, y: rabbit.y }, 0);
  sim.step(31_050);
  const fleeing = sim.snapshotFor(1).find((entity) => entity.netId === 1001)!;
  expect(Math.hypot(fleeing.vx, fleeing.vz)).toBeGreaterThan(5);
});
it.each(['storm', 'blizzard'] as const)(
  'walks to rock shelter in %s without teleporting, and abandons shelter when startled',
  (weather) => {
    const sim = world();
    const internal = sim as unknown as {
      animals: Map<number, { cover: { x: number; z: number } | null }>;
    };
    const cover = internal.animals.get(1002)!.cover!;
    expect(cover).not.toBeNull();
    sim.setTestWeather(weather);
    const clock = 1000;
    const start = sim.snapshotFor(1).find((entity) => entity.netId === 1002)!;
    sim.step(clock);
    const first = sim.snapshotFor(1).find((entity) => entity.netId === 1002)!;
    expect(Math.hypot(first.x - start.x, first.z - start.z)).toBeLessThan(0.2);
    for (let tick = 1; tick < 300; tick++) sim.step(clock + tick * 50);
    const sheltered = sim.snapshotFor(1).find((entity) => entity.netId === 1002)!;
    expect(Math.hypot(sheltered.x - cover.x, sheltered.z - cover.z)).toBeLessThan(0.6);
    expect(Math.hypot(sheltered.vx, sheltered.vz)).toBe(0);
    sim.placePlayer(1, { x: cover.x + 1, z: cover.z, y: sheltered.y }, 0);
    sim.step(clock + 15_050);
    const fleeing = sim.snapshotFor(1).find((entity) => entity.netId === 1002)!;
    expect(Math.hypot(fleeing.vx, fleeing.vz)).toBeGreaterThan(5);
  },
);
it('small wildlife collides with a solid rock while fleeing', () => {
  const sim = world(true);
  sim.collision.colliders.push(cylinder(100, 0, 1, 2, 0));
  sim.placeAnimal(1001, { x: 98.7, y: 0, z: 0 });
  sim.placePlayer(1, { x: 97.7, y: 0, z: 0 }, 0);
  for (let tick = 0; tick < 30; tick++) {
    sim.step(1000 + tick * 50);
    const rabbit = sim.snapshotFor(1).find((entity) => entity.netId === 1001)!;
    expect(Math.hypot(rabbit.x - 100, rabbit.z)).toBeGreaterThanOrEqual(1.15);
  }
});
