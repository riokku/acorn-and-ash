import { describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  ANIMAL_DENS,
  ANIMAL_KINDS,
  DEFAULT_WORLD_SEED,
  HIGH_PLAINS_PASS,
  HIGH_PLAINS,
  PLAINS_DENS,
  PROP_KINDS,
  buildWilderness,
  createWildernessTerrain,
  highPlainsHeightAt,
  highPlainsSand,
  highPlainsWeight,
  plainsPassAt,
  worldZoneAt,
  buildHighPlainsRocks,
} from '../src/index';

describe('Sunreach High Plains', () => {
  it('is a separate named region, with an unchanged home, lake, town and mountain range', () => {
    expect(worldZoneAt(HIGH_PLAINS.x, HIGH_PLAINS.z).id).toBe('highPlains');
    for (const [x, z] of [
      [0, 0],
      [88, -88],
      [176, 140],
      [-160, 150],
      [146, 42],
    ]) {
      expect(worldZoneAt(x!, z!).id).toBe('mountains');
      expect(highPlainsHeightAt(1, x!, z!, 13)).toBe(13);
    }
    expect(highPlainsWeight(-300, -220)).toBe(0);
    expect(highPlainsWeight(-220, -300)).toBe(0);
    expect(highPlainsSand(-230, -230)).toBeGreaterThan(0.65);
  });
  it.each([1, DEFAULT_WORLD_SEED, 999])(
    'provides a continuous walkable pass in seed %i',
    (seed) => {
      const terrain = createWildernessTerrain(seed);
      for (let i = 1; i < HIGH_PLAINS_PASS.length; i++) {
        const a = HIGH_PLAINS_PASS[i - 1]!,
          b = HIGH_PLAINS_PASS[i]!;
        let previous = terrain.heightAt(a[0], a[1]);
        for (let step = 1; step <= 40; step++) {
          const t = step / 40,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t;
          const y = terrain.heightAt(x, z),
            distance = Math.hypot(b[0] - a[0], b[1] - a[1]) / 40;
          expect(Math.abs(y - previous) / distance).toBeLessThan(0.35);
          expect(plainsPassAt(x, z).distance).toBeLessThan(0.001);
          previous = y;
        }
      }
    },
  );
  it('has distinct dune heights, a raised mesa and smoothly blended boundary', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    expect(terrain.heightAt(-253, -167)).toBeGreaterThan(25);
    const heights = Array.from({ length: 20 }, (_, i) => terrain.heightAt(-240 + i * 2, -228));
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2);
    for (let x = -155; x > -185; x -= 0.5) {
      expect(Math.abs(terrain.heightAt(x, -225) - terrain.heightAt(x - 0.5, -225))).toBeLessThan(1);
    }
  });
  it('keeps the pass clear and pairs every new rock with a solid, grounded collider', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const forest = buildWilderness(DEFAULT_WORLD_SEED, terrain);
    expect(new Set(forest.props.map((p) => p.id)).size).toBe(forest.props.length);
    expect(forest.props.filter((p) => p.id >= 46000).length).toBeGreaterThan(15);
    for (const prop of forest.props) {
      const radius = PROP_KINDS[prop.kind].colliderRadius * prop.scale;
      expect(plainsPassAt(prop.x, prop.z).distance).toBeGreaterThan(3.4 + radius);
      if (prop.id < 46000) continue;
      const collider = forest.colliders[forest.indexById.get(prop.id)!]!;
      expect(collider.standable).toBe(true);
      expect(prop.y).toBe(terrain.heightAt(prop.x, prop.z));
      expect(
        PLAINS_DENS.every((den) => Math.hypot(prop.x - den.x, prop.z - den.z) > 7 + radius),
      ).toBe(true);
    }
    expect(buildHighPlainsRocks(DEFAULT_WORLD_SEED, terrain)).toEqual(
      buildHighPlainsRocks(DEFAULT_WORLD_SEED, terrain),
    );
  });
  it('preserves recorded scenery IDs and positions outside the new region', () => {
    const legacy = [
      { id: 1008, x: -305.1192138250917, z: 1.4465304369106888 },
      { id: 2463, x: -148.96942359227688, z: 8.871334769809618 },
      { id: 4045, x: 8.808326218323781, z: -254.9898818849586 },
      { id: 4616, x: 54.30307966824621, z: -284.1656580119394 },
      { id: 5243, x: 101.13355465298518, z: 243.64876843965612 },
      { id: 5859, x: 148.78678304473868, z: -231.5319477441255 },
    ];
    const forest = buildWilderness(DEFAULT_WORLD_SEED, createWildernessTerrain(DEFAULT_WORLD_SEED));
    for (const expected of legacy) {
      expect(forest.props.find((prop) => prop.id === expected.id)).toMatchObject(expected);
    }
  });

  it('spawns the new wildlife and gives coyotes a real wind-up before damage', () => {
    const sim = new WorldSimulation({
      seed: DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    try {
      const den = PLAINS_DENS.find((d) => d.kind === 'coyote')!;
      sim.addPlayer(1, {
        netId: 1,
        x: den.x + 1,
        y: 0,
        z: den.z,
        facingYaw: 0,
        hunger: 100,
        health: 100,
        items: [],
      });
      sim.placePlayer(
        1,
        { x: den.x + 1, y: sim.collision.terrain.heightAt(den.x + 1, den.z), z: den.z },
        0,
      );
      expect(sim.snapshotFor(1).map((entity) => entity.netId)).toContain(den.id);
      for (let i = 0; i < 15; i++) sim.step(1000 + i * 50);
      expect(sim.healthOf(1)).toBe(100);
      for (let i = 15; i < 21; i++) sim.step(1000 + i * 50);
      expect(sim.healthOf(1)).toBe(72);
    } finally {
      sim.dispose();
    }
  });

  it('does not repeatedly reacquire a player outside the coyote pursuit leash', () => {
    const sim = new WorldSimulation({
      seed: DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    try {
      const den = PLAINS_DENS.find((d) => d.kind === 'coyote')!;
      const terrain = sim.collision.terrain;
      sim.addPlayer(1);
      sim.placeAnimal(den.id, { x: den.x + 39, y: terrain.heightAt(den.x + 39, den.z), z: den.z });
      sim.placePlayer(1, { x: den.x + 43, y: terrain.heightAt(den.x + 43, den.z), z: den.z }, 0);
      for (let i = 0; i < 30; i++) sim.step(1000 + i * 50);
      const animal = sim.snapshotFor(1).find((entity) => entity.netId === den.id)!;
      expect(animal.x).toBeLessThan(den.x + 39);
      expect(sim.healthOf(1)).toBe(100);
    } finally {
      sim.dispose();
    }
  });

  it('appends stable wildlife IDs and gives coyotes a readable, escapable threat', () => {
    expect(ANIMAL_DENS.slice(0, 7).map((d) => d.id)).toEqual([
      1001, 1002, 1003, 1004, 1005, 1006, 1007,
    ]);
    expect(new Set(ANIMAL_DENS.map((d) => d.id)).size).toBe(ANIMAL_DENS.length);
    for (const den of PLAINS_DENS) {
      expect(ANIMAL_DENS).toContainEqual(den);
      expect(highPlainsWeight(den.x, den.z)).toBeGreaterThan(0.4);
    }
    expect(ANIMAL_KINDS.coyote.threat.windupSeconds).toBeGreaterThanOrEqual(0.7);
    expect(ANIMAL_KINDS.coyote.threat.chaseSpeed).toBeLessThan(7);
    expect(ANIMAL_KINDS.coyote.preysOn).toContain('jackrabbit');
  });
});
