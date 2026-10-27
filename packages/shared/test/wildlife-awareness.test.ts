import { createInput, PlayerButton } from '../src/sim/player';
import { afterEach, describe, expect, it } from 'vitest';
import { ANIMAL_KINDS } from '../src/data/animals';
import { stepWildlifeAwareness, wildlifeNoticeRadius } from '../src/sim/wildlife-awareness';
import { WorldSimulation, SnapshotFlag } from '../src/sim/world-sim';
import { ANIMAL_DENS } from '../src/world/animals';

const kind = ANIMAL_KINDS.rabbit;

describe('quiet stalking', () => {
  it('lets walking get closer than running, with stationary observation quietest', () => {
    expect(wildlifeNoticeRadius(kind, 0)).toBeLessThan(wildlifeNoticeRadius(kind, 4.5));
    expect(wildlifeNoticeRadius(kind, 4.5)).toBeLessThan(wildlifeNoticeRadius(kind, 7));
    expect(stepWildlifeAwareness(0, false, 6, 4.5, kind, 0.05)).toMatchObject({
      attentive: true,
      fleeing: false,
      awareness: 0,
    });
    expect(stepWildlifeAwareness(0, false, 6, 7, kind, 0.05).awareness).toBeGreaterThan(0);
  });
  it('warns before fleeing, loses suspicion when the approach stops, and startles at close range', () => {
    let state = stepWildlifeAwareness(0, false, 4, 4.5, kind, 0.8);
    expect(state).toEqual({ awareness: 0.5, attentive: true, fleeing: false });
    state = stepWildlifeAwareness(state.awareness, false, 4, 0, kind, 0.5);
    expect(state.awareness).toBeCloseTo(0.3);
    expect(stepWildlifeAwareness(state.awareness, false, 20, 0, kind, 3)).toEqual({
      awareness: 0,
      attentive: false,
      fleeing: false,
    });
    expect(stepWildlifeAwareness(0, false, 1, 0, kind, 0.05).fleeing).toBe(true);
    expect(stepWildlifeAwareness(0, false, 6, 7, kind, 0.81).fleeing).toBe(true);
  });
  it('does not calm a fleeing animal just by releasing sprint', () => {
    expect(stepWildlifeAwareness(0, true, 6, 0, kind, 0.05).fleeing).toBe(true);
    expect(stepWildlifeAwareness(0, true, kind.safeRadius, 7, kind, 0.05).fleeing).toBe(false);
  });
});

const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function setup() {
  const sim = new WorldSimulation({ seed: 1234, raidIntervalSeconds: 86400 });
  worlds.push(sim);
  sim.addPlayer(1);
  const den = ANIMAL_DENS[0]!;
  const at = { x: den.x, z: den.z, y: sim.collision.terrain.heightAt(den.x, den.z) };
  sim.placeAnimal(den.id, at);
  const player = (id: number, gap: number) => {
    sim.placePlayer(id, { ...at, z: at.z + gap }, 0);
  };
  const animal = () =>
    sim.snapshotFor(1).find((e) => e.netId === den.id && e.flags & SnapshotFlag.Animal)!;
  return { sim, den, at, player, animal };
}

describe('authoritative animal attention', () => {
  it('stops, turns toward an observer and sends the existing alert pose before running', () => {
    const { sim, player, animal, at } = setup();
    player(1, 5.5);
    sim.step(1000);
    const seen = animal();
    expect(seen.action & 4).toBe(0); // Too far for a stationary observer.
    player(1, 4);
    sim.placeAnimal(seen.netId, at);
    sim.step(1050);
    expect(animal().action & 4).toBe(4);
    expect(Math.hypot(animal().vx, animal().vz)).toBe(0);
    expect(animal().yaw).not.toBe(seen.yaw);
  });
  it('detects close surprises immediately', () => {
    const { sim, player, animal } = setup();
    player(1, 1);
    sim.step(1000);
    expect(Math.hypot(animal().vx, animal().vz)).toBeCloseTo(kind.fleeSpeed);
  });
});

it('does not let an indoor observer startle outdoor wildlife', () => {
  const { sim, animal, at } = setup();
  sim.placePlayer(1, { ...at, z: at.z + 1 }, 0, 999);
  sim.step(1000);
  sim.placePlayer(1, { ...at, z: at.z + 20 }, 0);
  expect(animal().action & 4).toBe(0);
});

it('still bolts immediately from a nearby predator', () => {
  const { sim, player, animal, at } = setup();
  player(1, 20);
  sim.placeAnimal(1007, { ...at, z: at.z + 2 });
  sim.step(1000);
  expect(Math.hypot(animal().vx, animal().vz)).toBeCloseTo(kind.fleeSpeed);
});

it('notices a runner beyond a closer quiet observer', () => {
  const { sim, player, animal, at, den } = setup();
  player(1, 4.5);
  sim.addPlayer(2);
  sim.placePlayer(2, { ...at, x: at.x - 3, z: at.z + 6 }, 0);
  for (let i = 0; i < 24; i++) {
    sim.placeAnimal(den.id, at);
    sim.queueInput(2, createInput(i + 1, 1, 0, 0, PlayerButton.Sprint));
    sim.step(1000 + i * 50);
  }
  expect(Math.hypot(animal().vx, animal().vz)).toBeCloseTo(kind.fleeSpeed);
});

it('lets a quiet observer remain without keeping prey locked in its watching pose forever', () => {
  const { sim, player, animal } = setup();
  player(1, 4);
  sim.step(1000);
  expect(animal().action & 4).toBe(4);
  for (let i = 1; i <= 54; i++) sim.step(1000 + i * 50);
  expect(animal().action & 4).toBe(0);
});

it('sends a tense warning before flight and keeps the old alert bit', () => {
  const { sim, player, animal, at, den } = setup();
  player(1, 20);
  sim.addPlayer(2);
  sim.placePlayer(2, { ...at, x: at.x - 3, z: at.z + 6 }, 0);
  let warned = false,
    fled = false;
  for (let i = 0; i < 24; i++) {
    sim.placeAnimal(den.id, at);
    sim.queueInput(2, createInput(i + 1, 1, 0, 0, PlayerButton.Sprint));
    sim.step(1000 + i * 50);
    const flags = animal().action;
    if (flags & 16) {
      warned = true;
      expect(flags & 4).toBe(4);
      expect(flags & 32).toBe(0);
    }
    if (flags & 32) {
      fled = true;
      expect(warned).toBe(true);
      expect(flags & 4).toBe(4);
    }
  }
  expect(warned).toBe(true);
  expect(fled).toBe(true);
});
