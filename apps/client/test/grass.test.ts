import { describe, expect, it } from 'vitest';
import {
  buildTestClearing,
  buildWilderness,
  createWildernessTerrain,
  DEFAULT_WORLD_SEED,
  type BuiltPropView,
} from '@acorn/shared';
import { createGrass } from '../src/scene/grass';

function scene() {
  const clearing = buildTestClearing(DEFAULT_WORLD_SEED);
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  return {
    grass: createGrass(terrain, clearing, buildWilderness(DEFAULT_WORLD_SEED, terrain)),
    clearing,
    terrain,
  };
}
describe('nearby grass cover', () => {
  it('keeps grass above terrain, out of water, and within a bounded draw budget', () => {
    const { grass, clearing, terrain } = scene();
    try {
      grass.update(0.1, { x: 0, z: 6 }, false);
      expect(grass.mesh.count).toBeGreaterThan(1000);
      expect(grass.mesh.count).toBeLessThanOrEqual(18000);
      const roots = grass.mesh.geometry.getAttribute('grassRoot');
      for (let i = 0; i < grass.mesh.count; i++) {
        const x = roots.getX(i),
          z = roots.getZ(i);
        expect(Math.hypot(x, z - 6)).toBeLessThanOrEqual(36.001);
        expect(roots.getY(i)).toBeCloseTo(terrain.heightAt(x, z), 3);
        for (const water of clearing.water)
          expect(Math.hypot(x - water.x, z - water.z)).toBeGreaterThanOrEqual(water.radius + 0.349);
      }
    } finally {
      grass.dispose();
    }
  });
  it('does not rearrange overlapping clumps as the player crosses tile boundaries', () => {
    const { grass } = scene();
    try {
      const samples = () => {
        const roots = grass.mesh.geometry.getAttribute('grassRoot');
        return new Set(
          Array.from(
            { length: grass.mesh.count },
            (_, i) => `${roots.getX(i)},${roots.getZ(i)}`,
          ).filter((key) => {
            const [x, z] = key.split(',').map(Number);
            return Math.hypot(x!, z!) < 15;
          }),
        );
      };
      grass.update(0.1, { x: 0, z: 0 }, false);
      const before = samples();
      grass.update(0.1, { x: 13, z: 0 }, false);
      expect(samples()).toEqual(before);
    } finally {
      grass.dispose();
    }
  });
  it('clears building footprints immediately and permits disabling the effect', () => {
    const { grass } = scene();
    try {
      const cabin: BuiltPropView = {
        id: 7,
        kind: 'cabin',
        x: 8,
        z: 6,
        yaw: 0,
        lit: false,
        yours: true,
        locked: false,
      };
      grass.setBuildings([cabin]);
      grass.update(0.1, { x: 0, z: 6 }, true);
      const roots = grass.mesh.geometry.getAttribute('grassRoot');
      for (let i = 0; i < grass.mesh.count; i++)
        expect(Math.hypot(roots.getX(i) - 8, roots.getZ(i) - 6)).toBeGreaterThanOrEqual(3.59);
      const dense = grass.mesh.count;
      grass.setDensity(0.2);
      grass.update(0.1, { x: 0, z: 6 }, true);
      expect(grass.mesh.count).toBeLessThan(dense);
      grass.setDensity(0);
      expect(grass.mesh.visible).toBe(false);
    } finally {
      grass.dispose();
    }
  });
});
