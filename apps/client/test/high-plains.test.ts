import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import {
  DEFAULT_WORLD_SEED,
  buildTestClearing,
  buildWilderness,
  createWildernessTerrain,
} from '@acorn/shared';
import { createGroundShader } from '../src/art/ground-shading';
import { createGrass } from '../src/scene/grass';
import { createCritterFor } from '../src/scene/wildlife-models';

it('uses dry sand and warm ground in Sunreach without changing the home clearing', () => {
  const shader = createGroundShader({ props: [], water: [] });
  const plains = shader.shadeAt(-230, -230, 0, 20),
    home = shader.shadeAt(0, 0, 0, 0);
  expect(plains.bank[0]).toBeGreaterThan(0.65);
  expect(home.bank[0]).toBe(0);
  expect(plains.tint[0]).toBeGreaterThan(plains.tint[2]);
  expect(plains.snow).toBe(0);
});
it(
  'grounds dry grass on the actual dunes while forest grass retains its usual tint',
  { timeout: 15000 },
  () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
    const grass = createGrass(terrain, clearing, buildWilderness(DEFAULT_WORLD_SEED, terrain));
    try {
      grass.update(0.1, { x: 0, z: 6 }, true);
      expect(grass.mesh.geometry.getAttribute('grassBiome').getX(0)).toBe(0);
      for (let i = 0; i < 20; i++) grass.update(0.1, { x: -220, z: -190 }, true);
      expect(grass.mesh.count).toBeGreaterThan(100);
      const roots = grass.mesh.geometry.getAttribute('grassRoot'),
        biomes = grass.mesh.geometry.getAttribute('grassBiome');
      let maxAridity = 0,
        rootError = 0;
      for (let i = 0; i < grass.mesh.count; i++) {
        maxAridity = Math.max(maxAridity, biomes.getX(i));
        rootError = Math.max(
          rootError,
          Math.abs(roots.getY(i) - terrain.heightAt(roots.getX(i), roots.getZ(i))),
        );
      }
      expect(maxAridity).toBeGreaterThan(0.9);
      expect(rootError).toBeLessThan(0.001);
    } finally {
      grass.dispose();
    }
  },
);
it.each(['jackrabbit', 'coyote'] as const)(
  'animates the reused %s figure without moving its world root',
  (kind) => {
    const model = createCritterFor(kind, 1101);
    try {
      model.group.position.set(-220, 20, -214);
      for (let i = 0; i < 120; i++) model.update(1 / 60, { speed: 3, windup: i > 60 });
      expect(model.group.position.toArray()).toEqual([-220, 20, -214]);
      expect(
        new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3()).y,
      ).toBeGreaterThan(0.2);
      model.group.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const n of object.matrixWorld.elements) expect(Number.isFinite(n)).toBe(true);
      });
    } finally {
      model.dispose();
    }
  },
);
