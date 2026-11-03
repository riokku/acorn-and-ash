import { afterEach, describe, expect, it } from 'vitest';

import {
  ANIMAL_DENS,
  ANIMAL_KINDS,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  LAKE,
  PLAYABLE_HALF_EXTENT,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  TICK_MILLISECONDS,
  WorldSimulation,
  basinDepthAt,
  createWildernessTerrain,
} from '../src/index';

const bear = ANIMAL_KINDS.blackBear;
const bearDens = ANIMAL_DENS.filter((den) => den.kind === 'blackBear');

const built: WorldSimulation[] = [];
afterEach(() => built.splice(0).forEach((sim) => sim.dispose()));
let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);

describe('the black bear', () => {
  it('is big but slow: the hardest hitter, with the longest wind-up', () => {
    const others = Object.values(ANIMAL_KINDS).filter(
      (kind) => kind.id !== 'blackBear' && 'threat' in kind,
    );
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) {
      expect(bear.threat.damage).toBeGreaterThan(other.threat.damage);
      expect(bear.threat.windupSeconds).toBeGreaterThan(other.threat.windupSeconds);
    }
    // Three swipes knock you out; it takes eight of yours to win.
    expect(Math.ceil(HEALTH_MAX / bear.threat.damage)).toBe(3);
    expect(bear.threat.hitsToDefeat).toBe(8);
  });

  it('can be outrun by sprinting, but not by walking', () => {
    expect(bear.threat.chaseSpeed).toBeGreaterThan(PLAYER_WALK_SPEED);
    expect(bear.threat.chaseSpeed).toBeLessThan(PLAYER_SPRINT_SPEED);
  });

  it('keeps its dens at fixed ids in the deep woods, away from home, water and other animals', () => {
    expect(bearDens.map((den) => den.id)).toEqual([1011, 1012, 1013]);
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    for (const den of bearDens) {
      expect(Math.hypot(den.x, den.z)).toBeGreaterThan(140);
      expect(Math.max(Math.abs(den.x), Math.abs(den.z))).toBeLessThan(PLAYABLE_HALF_EXTENT - 40);
      expect(basinDepthAt(LAKE, den.x, den.z)).toBeLessThan(-25);
      for (const other of ANIMAL_DENS.filter((entry) => entry !== den))
        expect(Math.hypot(other.x - den.x, other.z - den.z)).toBeGreaterThan(60);
      // Gentle ground, so a fight there is fair.
      const rise = Math.abs(terrain.heightAt(den.x + 8, den.z) - terrain.heightAt(den.x, den.z));
      expect(rise / 8).toBeLessThan(0.2);
    }
  });

  it('lands a heavy swipe on someone who stays close through its wind-up', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(sim);
    const den = bearDens[0]!;
    sim.addPlayer(1);
    sim.placePlayer(1, { x: den.x, y: 0, z: den.z + bear.threat.attackRadius - 0.1 }, 0);
    // Past one wind-up (26 ticks), short of the cooldown after it.
    for (let i = 0; i < 40; i++) sim.step(tickClock());
    expect(sim.healthOf(1)).toBe(HEALTH_MAX - bear.threat.damage);
  });
});
