import { describe, expect, it } from 'vitest';

import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../src/constants';
import {
  createFlatTerrain,
  createWildernessTerrain,
  wildernessHillWeight,
} from '../src/world/terrain';

describe('flat terrain', () => {
  it('is the same height everywhere', () => {
    const terrain = createFlatTerrain(2.5);
    expect(terrain.heightAt(0, 0)).toBe(2.5);
    expect(terrain.heightAt(1000, -1000)).toBe(2.5);
  });

  it('defaults to sea level', () => {
    expect(createFlatTerrain().heightAt(3, 4)).toBe(0);
  });
});

describe('the wilderness terrain', () => {
  it('stays flat through the hand-built clearing and its tree line', () => {
    const terrain = createWildernessTerrain(4242);
    for (let radius = 0; radius <= WILDERNESS.flatRadius; radius += 5) {
      expect(terrain.heightAt(radius, 0)).toBe(0);
      expect(terrain.heightAt(0, -radius)).toBe(0);
    }
  });

  it('flattens again at and beyond the wall at the edge of the world', () => {
    const terrain = createWildernessTerrain(4242);
    expect(terrain.heightAt(PLAYABLE_HALF_EXTENT, 0)).toBe(0);
    expect(terrain.heightAt(0, PLAYABLE_HALF_EXTENT + 50)).toBe(0);
    // Past the corner of the square the wall clamps to, radius alone decides it.
    expect(terrain.heightAt(PLAYABLE_HALF_EXTENT, PLAYABLE_HALF_EXTENT)).toBe(0);
  });

  it('rolls into hills somewhere in between, bounded by the configured height', () => {
    const terrain = createWildernessTerrain(4242);
    let sawNonZero = false;
    for (let radius = WILDERNESS.flatRadius; radius < PLAYABLE_HALF_EXTENT; radius += 3) {
      for (const angle of [0, 1.3, 2.7, 4.1, 5.5]) {
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = terrain.heightAt(x, z);
        expect(Number.isFinite(height)).toBe(true);
        expect(Math.abs(height)).toBeLessThanOrEqual(WILDERNESS.hillHeight + 1e-9);
        if (height !== 0) sawNonZero = true;
      }
    }
    expect(sawNonZero).toBe(true);
  });

  it('gives the same height for the same seed and position, every time', () => {
    const terrain = createWildernessTerrain(123);
    const first = terrain.heightAt(70, -40);
    const second = createWildernessTerrain(123).heightAt(70, -40);
    expect(second).toBe(first);
  });

  it('gives a different shape for a different seed', () => {
    const a = createWildernessTerrain(1);
    const b = createWildernessTerrain(2);
    // Somewhere out in the hills, not necessarily at any one sampled point.
    const heightsA = [40, 60, 80, 100].map((r) => a.heightAt(r, r * 0.5));
    const heightsB = [40, 60, 80, 100].map((r) => b.heightAt(r, r * 0.5));
    expect(heightsA).not.toEqual(heightsB);
  });
});

describe('wildernessHillWeight', () => {
  it('is zero at the centre, full strength through the middle of the wilderness, and zero past the wall', () => {
    expect(wildernessHillWeight(0)).toBe(0);
    expect(wildernessHillWeight(WILDERNESS.flatRadius)).toBe(0);
    const middle = (WILDERNESS.flatRadius + (PLAYABLE_HALF_EXTENT - WILDERNESS.edgeFlat)) / 2;
    expect(wildernessHillWeight(middle)).toBeGreaterThan(0.9);
    expect(wildernessHillWeight(PLAYABLE_HALF_EXTENT)).toBe(0);
    expect(wildernessHillWeight(PLAYABLE_HALF_EXTENT + 1000)).toBe(0);
  });

  it('never goes outside [0, 1]', () => {
    for (let radius = -10; radius <= PLAYABLE_HALF_EXTENT + 20; radius += 2.5) {
      const weight = wildernessHillWeight(radius);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });
});
