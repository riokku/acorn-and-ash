import { describe, expect, it } from 'vitest';
import { MAX_WALKABLE_GRADIENT, DEFAULT_WORLD_SEED } from '../src/constants';
import { POND, ROD_SPOT, buildTestClearing } from '../src/world/clearing';
import { isOnWater } from '../src/world/water';
import { pondGroundHeight } from '../src/world/pond';
import { createWildernessTerrain } from '../src/world/terrain';

describe('the recessed starting pond', () => {
  it('puts the bed below level water and the nearby bank above it', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    expect(terrain.heightAt(12.8, -5)).toBeLessThan(-0.5);
    expect(terrain.heightAt(5.8, -5)).toBeGreaterThan(0.2);
    expect(terrain.heightAt(3, -5)).toBe(0);
    expect(terrain.heightAt(0, 0)).toBe(0);
    expect(terrain.heightAt(ROD_SPOT.x, ROD_SPOT.z)).toBeLessThan(0.4);
    expect(isOnWater(POND, ROD_SPOT.x, ROD_SPOT.z)).toBe(false);
  });

  it('keeps the dry bank smooth and gentle enough to walk over', () => {
    const step = 0.015;
    for (let x = 3; x < 26; x += 0.13) {
      for (let z = -16; z < 8; z += 0.13) {
        if (isOnWater(POND, x, z)) continue;
        const dx =
          (pondGroundHeight(POND, x + step, z) - pondGroundHeight(POND, x - step, z)) / (2 * step);
        const dz =
          (pondGroundHeight(POND, x, z + step) - pondGroundHeight(POND, x, z - step)) / (2 * step);
        expect(Math.hypot(dx, dz)).toBeLessThan(MAX_WALKABLE_GRADIENT);
      }
    }
  });

  it('leaves unrelated terrain alone, even when it is elevated', () => {
    expect(pondGroundHeight(POND, -10, 5, 2)).toBe(2);
    expect(pondGroundHeight([], 12, -5, 2)).toBe(2);
    expect(pondGroundHeight(POND, 26, -5, 2)).toBe(2);
  });

  it('plants scenery at the physical height and keeps custom flat test terrain consistent', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
    for (const prop of clearing.props) expect(prop.y ?? 0).toBe(terrain.heightAt(prop.x, prop.z));
    const flat = buildTestClearing(DEFAULT_WORLD_SEED, { kind: 'flat', heightAt: () => 0 });
    expect(flat.props.every((p) => (p.y ?? 0) === 0)).toBe(true);
  });
});
