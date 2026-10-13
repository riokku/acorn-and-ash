import { expect, it } from 'vitest';
import {
  STREAM,
  streamPools,
  streamPointAt,
  streamHalfWidthAt,
  streamWaterHalfWidthAt,
  streamSurfaceAt,
  sloughSurfaceAt,
  STREAM_KEEP_OUT,
  streamWaterDepthAt,
  createWildernessTerrain,
  createCollisionWorld,
  setLakeFrozen,
  LAKE,
  basinDepthAt,
  isInStream,
  nearStream,
  navigableWaterDepthAt,
} from '../src/index';

it('supports the connected spring floor and rim, protects it from props and freezes it', () => {
  const spring = STREAM.spring!;
  const source = streamPointAt(STREAM, 0);
  expect(streamPools(STREAM)).toContain(spring);
  expect(basinDepthAt(spring, source.x, source.z)).toBeGreaterThan(0);
  expect(sloughSurfaceAt(STREAM, spring, source.x, source.z)).toBe(streamSurfaceAt(STREAM, 0));
  for (const seed of [1, 42, 1234, 98765]) {
    const terrain = createWildernessTerrain(seed);
    const collision = createCollisionWorld(terrain, [], undefined, LAKE, false, STREAM);
    for (const circle of spring.basin) {
      expect(STREAM_KEEP_OUT).toContainEqual(circle);
      expect(nearStream(STREAM, circle.x, circle.z, 1.2)).toBe(true);
      expect(navigableWaterDepthAt(circle.x, circle.z)).toBeGreaterThan(0);
      const surface = sloughSurfaceAt(STREAM, spring, circle.x, circle.z);
      expect(surface - terrain.heightAt(circle.x, circle.z)).toBeGreaterThan(0.1);
      expect(surface - terrain.heightAt(circle.x, circle.z)).toBeLessThan(0.8);
      for (let step = 0; step < 32; step++) {
        const angle = (step * Math.PI) / 16;
        const x = circle.x + Math.cos(angle) * circle.radius;
        const z = circle.z + Math.sin(angle) * circle.radius;
        if (basinDepthAt(spring, x, z) > 0.02 || isInStream(STREAM, x, z, -1)) continue;
        expect(terrain.heightAt(x, z)).toBeGreaterThan(
          sloughSurfaceAt(STREAM, spring, x, z) + 0.05,
        );
      }
    }
    setLakeFrozen(collision, true);
    expect(collision.terrain.heightAt(source.x, source.z)).toBeCloseTo(
      streamSurfaceAt(STREAM, 0) + 0.05,
      5,
    );
    setLakeFrozen(collision, false);
    expect(collision.terrain.heightAt(source.x, source.z)).toBe(
      terrain.heightAt(source.x, source.z),
    );
  }
});

it('varies shorelines independently and smoothly inside the conservative placement extent', () => {
  let different = 0;
  for (let along = 35; along < STREAM.length - 25; along += 2) {
    const left = streamHalfWidthAt(STREAM, along, 1),
      right = streamHalfWidthAt(STREAM, along, -1);
    const extent = streamHalfWidthAt(STREAM, along);
    if (Math.abs(left - right) > 0.1) different++;
    for (const side of [-1, 1]) {
      const half = streamHalfWidthAt(STREAM, along, side);
      expect(half).toBeLessThanOrEqual(extent);
      expect(half).toBeGreaterThan(extent * 0.6);
      expect(Math.abs(half - streamHalfWidthAt(STREAM, along + 0.01, side))).toBeLessThan(0.004);
      expect(streamWaterHalfWidthAt(STREAM, along, side)).toBeLessThan(half);
    }
  }
  expect(different).toBeGreaterThan(60);
  for (const along of [0, STREAM.length])
    expect(streamHalfWidthAt(STREAM, along, -1)).toBe(streamHalfWidthAt(STREAM, along, 1));
});

it('agrees on visible shore and water depth along both uneven banks', () => {
  for (const row of [70, 120, 210]) {
    const here = streamPointAt(STREAM, row),
      before = streamPointAt(STREAM, row - 1),
      after = streamPointAt(STREAM, row + 1);
    const dx = after.x - before.x,
      dz = after.z - before.z,
      length = Math.hypot(dx, dz);
    const along = (row * STREAM.length) / (STREAM.count - 1);
    for (const side of [-1, 1]) {
      const half = streamWaterHalfWidthAt(STREAM, along, side);
      const at = (reach: number) => ({
        x: here.x - (dz / length) * reach * side,
        z: here.z + (dx / length) * reach * side,
      });
      const inside = at(half - 0.4),
        outside = at(half + 0.5);
      expect(isInStream(STREAM, inside.x, inside.z)).toBe(true);
      expect(streamWaterDepthAt(STREAM, inside.x, inside.z)).toBeGreaterThan(0);
      expect(isInStream(STREAM, outside.x, outside.z)).toBe(false);
      expect(streamWaterDepthAt(STREAM, outside.x, outside.z)).toBe(0);
    }
  }
});

it('alternates broad and narrow reaches instead of only offsetting opposite banks', () => {
  const ratios = [];
  for (let along = 40; along < STREAM.length - 30; along += 3) {
    const width = streamHalfWidthAt(STREAM, along, -1) + streamHalfWidthAt(STREAM, along, 1);
    ratios.push(width / (2 * streamHalfWidthAt(STREAM, along)));
  }
  expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.16);
});
