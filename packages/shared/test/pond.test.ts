import { describe, expect, it } from 'vitest';
import {
  MAX_WALKABLE_GRADIENT,
  DEFAULT_WORLD_SEED,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
} from '../src/constants';
import { POND, ROD_SPOT, buildTestClearing } from '../src/world/clearing';
import { isOnWater, waterColliders, type WaterCircle } from '../src/world/water';
import {
  pondGroundHeight,
  pondWaterDepthAt,
  POND_LEVEL,
  POND_WADING_SHORE_DEPTH,
} from '../src/world/pond';
import { LAKE_WADING_DEPTH } from '../src/world/lake';
import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
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

  it('uses the same water depth for the bed and wading limit, including overlapping lobes', () => {
    for (let x = 4; x < 24; x += 0.2) {
      for (let z = -14; z < 5; z += 0.2) {
        if (!isOnWater(POND, x, z)) continue;
        const depth = pondWaterDepthAt(POND, x, z);
        expect(depth).toBeCloseTo(POND_LEVEL - pondGroundHeight(POND, x, z), 10);
        const deep = isOnWater(POND, x, z, POND_WADING_SHORE_DEPTH);
        expect(deep).toBe(depth >= LAKE_WADING_DEPTH);
      }
    }
    expect(pondWaterDepthAt(POND, 0, 0)).toBe(0);
    expect(pondWaterDepthAt([], 0, 0)).toBe(0);
  });

  it('allows shallow entry around every lobe and keeps the whole player out of deep water', () => {
    const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
    const world = createCollisionWorld(terrain, waterColliders(POND, POND_WADING_SHORE_DEPTH));
    let shores = 0;
    for (const circle of POND) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const nx = Math.cos(angle),
          nz = Math.sin(angle);
        const at = (distance: number) => ({
          x: circle.x + nx * distance,
          z: circle.z + nz * distance,
        });
        // Skip boundaries hidden under another lobe: those are open water.
        const shore = at(circle.radius + 0.05);
        if (isOnWater(POND, shore.x, shore.z)) continue;
        shores++;
        const shallow = at(circle.radius - 0.4);
        const feet = { ...shallow, y: terrain.heightAt(shallow.x, shallow.z) };
        expect(resolveCapsule(feet, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
        expect(isOnWater(POND, feet.x, feet.z)).toBe(true);
        const tooDeep = at(circle.radius - POND_WADING_SHORE_DEPTH - 0.1);
        const blocked = { ...tooDeep, y: terrain.heightAt(tooDeep.x, tooDeep.z) };
        expect(resolveCapsule(blocked, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
        for (let around = 0; around < Math.PI * 2; around += Math.PI / 8)
          expect(
            pondWaterDepthAt(
              POND,
              blocked.x + Math.cos(around) * PLAYER_RADIUS,
              blocked.z + Math.sin(around) * PLAYER_RADIUS,
            ),
          ).toBeLessThanOrEqual(LAKE_WADING_DEPTH + 0.0001);
      }
    }
    expect(shores).toBeGreaterThan(32);
  });

  it('leaves a wholly shallow small pond open', () => {
    const water: readonly WaterCircle[] = [{ x: 0, z: 0, radius: POND_WADING_SHORE_DEPTH - 0.1 }];
    expect(waterColliders(water, POND_WADING_SHORE_DEPTH)).toEqual([]);
    expect(pondWaterDepthAt(water, 0, 0)).toBeLessThan(LAKE_WADING_DEPTH);
  });
});
