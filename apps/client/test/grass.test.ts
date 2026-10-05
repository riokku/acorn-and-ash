import * as THREE from 'three/webgpu';
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
      expect(grass.mesh.count).toBeLessThanOrEqual(24000);
      const roots = grass.mesh.geometry.getAttribute('grassRoot');
      for (let i = 0; i < grass.mesh.count; i++) {
        const x = roots.getX(i),
          z = roots.getZ(i);
        // The 32 m it is drawn to, plus the 4 m walked before it is laid out again, plus a metre.
        expect(Math.hypot(x, z - 6)).toBeLessThanOrEqual(37.001);
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
  it('has every clump you could see already in place after a few steps, so none pop in at the edge', () => {
    // Grass fades out by distance from where you stand now, not from where it was
    // last laid out. Walk almost as far as the grass is laid out again for, and
    // what shows within the draw distance must be what a fresh layout there shows.
    const within = (grass: ReturnType<typeof scene>['grass'], at: { x: number; z: number }) => {
      const roots = grass.mesh.geometry.getAttribute('grassRoot');
      return new Set(
        Array.from({ length: grass.mesh.count }, (_, i) => [roots.getX(i), roots.getZ(i)] as const)
          .filter(([x, z]) => Math.hypot(x - at.x, z - at.z) <= 31.9)
          .map(([x, z]) => `${x},${z}`),
      );
    };
    const walker = scene().grass;
    const fresh = scene().grass;
    try {
      walker.update(0.1, { x: 0, z: 0 }, false);
      walker.update(0.1, { x: 3.9, z: 0 }, false);
      fresh.update(0.1, { x: 3.9, z: 0 }, false);
      const seen = within(fresh, { x: 3.9, z: 0 });
      expect(seen.size).toBeGreaterThan(1000);
      expect(within(walker, { x: 3.9, z: 0 })).toEqual(seen);
    } finally {
      walker.dispose();
      fresh.dispose();
    }
  });
  it('varies the size, shape, lean and colour of clumps so the meadow is not uniform', () => {
    const { grass } = scene();
    try {
      grass.update(0.1, { x: 0, z: 6 }, false);
      const looks = grass.mesh.geometry.getAttribute('grassLook');
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const spin = new THREE.Quaternion();
      const size = new THREE.Vector3();
      const heights: number[] = [];
      const widths: number[] = [];
      const facings = new Set<number>();
      const tones: number[] = [];
      let leaning = 0;
      for (let i = 0; i < grass.mesh.count; i++) {
        grass.mesh.getMatrixAt(i, matrix);
        matrix.decompose(position, spin, size);
        // Trampled clumps are flattened on purpose; the variety is among the rest.
        if (size.y > 0.2) heights.push(size.y);
        widths.push(size.x);
        facings.add(Math.round(spin.y * 20));
        tones.push(looks.getX(i));
        if (looks.getY(i) > 0.03) leaning++;
        expect(size.y).toBeLessThanOrEqual(1.8001);
        expect(looks.getX(i)).toBeGreaterThanOrEqual(0);
        expect(looks.getX(i)).toBeLessThanOrEqual(1);
        expect(looks.getY(i)).toBeLessThanOrEqual(0.12);
        expect(looks.getW(i)).toBeGreaterThan(0.5);
      }
      const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
      const share = (values: number[], test: (value: number) => boolean) =>
        values.filter(test).length / values.length;
      // Short tufts, middling ones and a few tall ones - not one height.
      expect(spread(heights)).toBeGreaterThan(0.8);
      expect(share(heights, (height) => height < 0.8)).toBeGreaterThan(0.2);
      expect(share(heights, (height) => height > 1.3)).toBeGreaterThan(0.01);
      expect(share(heights, (height) => height > 1.3)).toBeLessThan(0.15);
      expect(spread(widths)).toBeGreaterThan(0.5);
      // They face every which way rather than all alike.
      expect(facings.size).toBeGreaterThan(20);
      // Lush through to dry, and some lean over.
      expect(share(tones, (tone) => tone < 0.3)).toBeGreaterThan(0.05);
      expect(share(tones, (tone) => tone > 0.6)).toBeGreaterThan(0.05);
      expect(leaning / grass.mesh.count).toBeGreaterThan(0.1);
    } finally {
      grass.dispose();
    }
  });
  it('gives each blade its own height and place, so a clump is not a symmetrical star', () => {
    const { grass } = scene();
    try {
      const geometry = grass.mesh.geometry;
      const heights = geometry.getAttribute('position');
      const tips = geometry.getAttribute('grassTip');
      const tops = new Set<number>();
      for (let i = 0; i < heights.count; i++) {
        expect(tips.getX(i)).toBeGreaterThanOrEqual(0);
        expect(tips.getX(i)).toBeLessThanOrEqual(1);
        if (tips.getX(i) === 1) tops.add(Math.round(heights.getY(i) * 1000));
      }
      // Six blades, six different heights.
      expect(tops.size).toBe(6);
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
