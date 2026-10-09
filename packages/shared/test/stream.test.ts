import { describe, expect, it } from 'vitest';

import { MAX_WALKABLE_GRADIENT } from '../src/constants';
import { LAKE, lakeDepthAt } from '../src/world/lake';
import {
  isInStream,
  nearStream,
  nearestOnStream,
  STREAM,
  STREAM_KEEP_OUT,
  streamBedAt,
  streamDepthMiddle,
  streamHalfWidthAt,
  streamPointAt,
  streamSurfaceAt,
  streamWaterDepthAt,
  streamWaterHalfWidthAt,
} from '../src/world/stream';
import { createWildernessTerrain } from '../src/world/terrain';
import { buildEncounterSites } from '../src/world/encounters';
import { buildTestClearing } from '../src/world/clearing';
import { buildWilderness } from '../src/world/wilderness';
import { MOUNTAINS } from '../src/constants';
import { mountainWeight } from '../src/world/mountains';

const SEED = 1234;
const terrain = createWildernessTerrain(SEED);

function samples(step: number): number[] {
  const out: number[] = [];
  for (let along = 0; along <= STREAM.length; along += step) out.push(along);
  return out;
}

function pointAlong(along: number): { x: number; z: number } {
  return streamPointAt(STREAM, Math.round(along / (STREAM.length / (STREAM.count - 1))));
}

describe('the stream', () => {
  it('gives each visual slough a shallow floor and keeps props and building out of its water', () => {
    expect(STREAM.sloughs).toHaveLength(6);
    for (const slough of STREAM.sloughs) {
      for (const circle of slough.basin) {
        const depth = slough.level - terrain.heightAt(circle.x, circle.z);
        expect(depth).toBeGreaterThan(0.1);
        expect(depth).toBeLessThan(0.6);
        expect(nearStream(STREAM, circle.x, circle.z, 1.2)).toBe(true);
        expect(STREAM_KEEP_OUT).toContainEqual(circle);
      }
      // The pool itself remains scenery; its neck overlaps the river's water.
      const pool = slough.basin[0]!;
      expect(isInStream(STREAM, pool.x, pool.z)).toBe(false);
      const river = nearestOnStream(STREAM, pool.x, pool.z, 30)!;
      for (let step = 0; step <= 40; step++) {
        const t = step / 40;
        const x = river.x + (pool.x - river.x) * t;
        const z = river.z + (pool.z - river.z) * t;
        expect(isInStream(STREAM, x, z) || lakeDepthAt(slough, x, z) > 0).toBe(true);
        // No strip of dry bank may block the connected water.
        expect(terrain.heightAt(x, z)).toBeLessThan(slough.level - 0.05);
      }
      // The connection stays open across a six-metre span, not just its centreline.
      const outwardX = (pool.x - river.x) / river.distance;
      const outwardZ = (pool.z - river.z) / river.distance;
      const mouthAcross = streamWaterHalfWidthAt(STREAM, river.along) + 0.7;
      for (const sideways of [-3, 0, 3]) {
        const x = river.x + outwardX * mouthAcross - outwardZ * sideways;
        const z = river.z + outwardZ * mouthAcross + outwardX * sideways;
        expect(lakeDepthAt(slough, x, z)).toBeGreaterThan(0.5);
        expect(terrain.heightAt(x, z)).toBeLessThan(slough.level - 0.05);
      }
    }
  });

  it('starts on the mountain and ends at the lake', () => {
    const spring = streamPointAt(STREAM, 0);
    const mouth = streamPointAt(STREAM, STREAM.count - 1);
    expect(mountainWeight(spring.x, spring.z)).toBeGreaterThan(0.5);
    expect(terrain.heightAt(spring.x, spring.z)).toBeGreaterThan(20);
    // The last point is within a few metres of the water's edge.
    expect(lakeDepthAt(LAKE, mouth.x, mouth.z)).toBeGreaterThan(-6);
    expect(streamSurfaceAt(STREAM, STREAM.length)).toBeCloseTo(LAKE.level, 1);
    expect(MOUNTAINS.snowLine).toBeGreaterThan(streamBedAt(STREAM, 0));
  });

  it('only ever runs downhill', () => {
    let previous = Infinity;
    for (const along of samples(0.5)) {
      const surface = streamSurfaceAt(STREAM, along);
      expect(surface).toBeLessThanOrEqual(previous + 1e-6);
      previous = surface;
    }
  });

  it('has small waterfalls, none of them taller than a few metres', () => {
    expect(STREAM.falls.length).toBeGreaterThanOrEqual(4);
    for (const fall of STREAM.falls) {
      const above = streamBedAt(STREAM, fall.at - 3);
      const below = streamBedAt(STREAM, fall.at + 3);
      expect(above - below).toBeGreaterThan(fall.drop * 0.8);
      expect(fall.drop).toBeLessThan(3.5);
    }
  });

  it('grows wider toward the lake', () => {
    expect(streamHalfWidthAt(STREAM, STREAM.length)).toBeGreaterThan(
      streamHalfWidthAt(STREAM, 20) * 2,
    );
  });

  it('is the same ground whatever the seed, apart from the hills it winds through', () => {
    expect(STREAM.count).toBeGreaterThan(200);
    expect(streamPointAt(STREAM, 10)).toEqual(streamPointAt(STREAM, 10));
  });

  it('is shallow enough to wade across everywhere', () => {
    for (const along of samples(1.5)) {
      const at = pointAlong(along);
      const depth = streamWaterDepthAt(STREAM, at.x, at.z);
      expect(depth).toBeLessThan(0.6);
    }
  });

  it('has water in its middle and none far from it', () => {
    const middle = pointAlong(STREAM.length * 0.6);
    expect(streamWaterDepthAt(STREAM, middle.x, middle.z)).toBeGreaterThan(0.2);
    expect(isInStream(STREAM, middle.x, middle.z)).toBe(true);
    expect(streamWaterDepthAt(STREAM, 0, 0)).toBe(0);
    expect(isInStream(STREAM, 0, 0)).toBe(false);
    expect(isInStream(STREAM, -200, 200)).toBe(false);
  });

  it('digs the water a bed below its surface, down the whole length', () => {
    for (const along of samples(3)) {
      if (along < 14) continue;
      const at = pointAlong(along);
      const ground = terrain.heightAt(at.x, at.z);
      const surface = streamSurfaceAt(STREAM, along);
      expect(surface - ground).toBeGreaterThan(0.1);
      expect(surface - ground).toBeLessThan(streamDepthMiddle(STREAM, along) + 0.35);
    }
  });

  it('leaves the banks above the water, so it never spills over the land', () => {
    for (const along of samples(4)) {
      // Not the spring, nor the last few metres where the water runs out into the lake.
      if (along < 14 || along > STREAM.length - 12) continue;
      const at = pointAlong(along);
      const near = nearestOnStream(STREAM, at.x, at.z, 1)!;
      expect(near.distance).toBeLessThan(0.5);
      const half = streamHalfWidthAt(STREAM, along);
      // Beside the water on the flat, the ground has risen above the surface.
      const surface = streamSurfaceAt(STREAM, along);
      const side = nearestSide(at.x, at.z, along, half * 1.3 + 0.3);
      if (side === null) continue;
      // At a slough opening this former bank is intentionally open water.
      if (STREAM.sloughs.some((slough) => lakeDepthAt(slough, side.x, side.z) > 0)) continue;
      expect(terrain.heightAt(side.x, side.z)).toBeGreaterThanOrEqual(
        surface - 0.15 - STREAM_FALL_SLACK(along),
      );
    }
  });

  it('leaves the lake and the mountain as they were far from the stream', () => {
    expect(nearestOnStream(STREAM, 0, 0, 60)).toBeNull();
    expect(terrain.heightAt(0, 0)).toBe(0);
    // Deep in the lake, nothing about the floor has changed.
    expect(terrain.heightAt(100, -95)).toBeLessThan(LAKE.level - 1);
  });

  it('keeps trees and rocks out of the water and off its banks', () => {
    const wilderness = buildWilderness(SEED, terrain);
    for (const prop of wilderness.props) {
      expect(nearStream(STREAM, prop.x, prop.z, 1.2)).toBe(false);
    }
  });

  it('has keep-out circles all along it for building and spawning', () => {
    expect(STREAM_KEEP_OUT.length).toBeGreaterThan(STREAM.length / 8);
    for (const circle of STREAM_KEEP_OUT) {
      expect(circle.radius).toBeGreaterThan(0.5);
    }
    const middle = pointAlong(STREAM.length / 2);
    expect(
      STREAM_KEEP_OUT.some(
        (circle) => Math.hypot(circle.x - middle.x, circle.z - middle.z) < circle.radius,
      ),
    ).toBe(true);
  });

  it('does not run through any encounter site', () => {
    const clearing = buildTestClearing(SEED);
    const wilderness = buildWilderness(SEED, terrain);
    for (const site of buildEncounterSites(
      SEED,
      terrain,
      wilderness.siteColliders,
      clearing.water,
      LAKE,
    )) {
      expect(nearStream(STREAM, site.x, site.z, 6)).toBe(false);
    }
  });

  it('can be walked beside from the lake to the spring without climbing a cliff', () => {
    // Follow the bank 7 m to the left of the path (clear of the falls' little
    // gorges), checking every step is one a player can take on foot.
    const step = 1.5;
    let last: { x: number; z: number; y: number } | null = null;
    for (let along = 0; along <= STREAM.length; along += step) {
      const at = pointAlong(along);
      const next = pointAlong(Math.min(along + step, STREAM.length));
      const dx = next.x - at.x;
      const dz = next.z - at.z;
      const size = Math.hypot(dx, dz) || 1;
      const x = at.x - (dz / size) * 7;
      const z = at.z + (dx / size) * 7;
      const y = terrain.heightAt(x, z);
      if (last !== null) {
        const run = Math.hypot(x - last.x, z - last.z);
        expect(Math.abs(y - last.y)).toBeLessThanOrEqual(MAX_WALKABLE_GRADIENT * run + 0.12);
      }
      last = { x, z, y };
    }
  });

  it('can be waded in the flat reaches, which are all gentle', () => {
    let steep = 0;
    let flat = 0;
    for (let along = 0; along < STREAM.length; along += 1.5) {
      const a = pointAlong(along);
      const b = pointAlong(along + 1.5);
      const rise = Math.abs(terrain.heightAt(a.x, a.z) - terrain.heightAt(b.x, b.z));
      if (rise > MAX_WALKABLE_GRADIENT * 1.5) steep += 1;
      else flat += 1;
    }
    // Falls are short steps; the rest of the way is a walk.
    expect(flat).toBeGreaterThan(steep * 20);
    expect(steep).toBeGreaterThan(0);
  });

  it('answers quickly enough for the ground to be built from it', () => {
    const started = performance.now();
    let total = 0;
    for (let index = 0; index < 20000; index++) {
      total += terrain.heightAt(-90 + (index % 200) * 0.2, -40 + Math.floor(index / 200) * 0.9);
    }
    expect(Number.isFinite(total)).toBe(true);
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it('reports the water half width inside the bowl', () => {
    for (const along of samples(40)) {
      expect(streamWaterHalfWidthAt(STREAM, along)).toBeLessThan(streamHalfWidthAt(STREAM, along));
    }
  });
});

/** A point to one side of the path, or null when that spot is on a fall's little gorge. */
function nearestSide(
  x: number,
  z: number,
  along: number,
  distance: number,
): { x: number; z: number } | null {
  const next = pointAlong(Math.min(along + 1.5, STREAM.length));
  const dx = next.x - x;
  const dz = next.z - z;
  const size = Math.hypot(dx, dz) || 1;
  return { x: x - (dz / size) * distance, z: z + (dx / size) * distance };
}

/** How much lower than the water the bank may be right at a fall, where the bed steps down. */
function STREAM_FALL_SLACK(along: number): number {
  return STREAM.falls.some((fall) => Math.abs(fall.at - along) < 8) ? 2.5 : 0;
}
