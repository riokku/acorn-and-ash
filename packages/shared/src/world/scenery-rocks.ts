import { createRng } from '../rng';
import type { Terrain } from './terrain';
import { basinDepthAt, LAKE, type Lake } from './lake';
import { smoothstep } from '../math/vec3';
import {
  STREAM_STONES_PER_100M,
  streamPools,
  streamPointAt,
  streamWaterHalfWidthAt,
  isInStream,
  streamBedAt,
  type Stream,
} from './stream';
import { stonePositions } from './stone-shape';
import { surfaceCollider } from '../collision/solid-surface';

const seededRandom = (seed: number) => createRng(seed).nextFloat;
export interface SceneryRock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly seed: number;
  readonly yaw: number;
  readonly detail: number;
  readonly tile: number;
}
export function buildSpringRocks(stream: Stream, terrain: Terrain) {
  const rocks: SceneryRock[] = [];
  const spring = stream.spring;
  if (spring !== undefined) {
    const source = spring.basin[0]!;
    const next = streamPointAt(stream, 4);
    const upstream = Math.atan2(source.z - next.z, source.x - next.x);
    const random = seededRandom(7219);
    for (let index = 0; index < 7; index++) {
      const angle = upstream - 1.05 + index * 0.35 + (random() - 0.5) * 0.16;
      const radius = 1.2 + random() * 1.3;
      const height = radius * (0.9 + random() * 0.5);
      const reach = source.radius + radius * 0.45;
      const x = source.x + Math.cos(angle) * reach;
      const z = source.z + Math.sin(angle) * reach;
      const y = terrain.heightAt(x, z) - height * 0.18;
      rocks.push({
        x,
        y,
        z,
        radius,
        height,
        seed: 7219 + index,
        yaw: random() * Math.PI * 2,
        detail: 1,
        tile: 0.8,
      });
    }
  }
  return rocks;
}

export function buildWaterfallRocks(stream: Stream, terrain: Terrain) {
  const rocks: SceneryRock[] = [];
  for (const [index, fall] of stream.falls.entries()) {
    const random = seededRandom(4909 + index * 173);
    const placements: { x: number; z: number; radius: number }[] = [];
    for (let attempt = 0; attempt < 60 && placements.length < 8; attempt++) {
      const along = fall.at - 5 + random() * 13;
      const row = Math.round(along / (stream.length / (stream.count - 1)));
      const here = streamPointAt(stream, row);
      const before = streamPointAt(stream, row - 1),
        after = streamPointAt(stream, row + 1);
      const dx = after.x - before.x,
        dz = after.z - before.z,
        length = Math.hypot(dx, dz);
      const radius = 0.6 + random() * 0.9;
      const side = random() < 0.5 ? -1 : 1;
      const reach =
        side * (streamWaterHalfWidthAt(stream, along, side) + radius + 0.25 + random() * 1.3);
      const x = here.x - (dz / length) * reach,
        z = here.z + (dx / length) * reach;
      if (isInStream(stream, x, z, -radius - 0.15)) continue;
      if (
        placements.some(
          (rock) => Math.hypot(x - rock.x, z - rock.z) < (radius + rock.radius) * 0.85,
        )
      )
        continue;
      const heights = [terrain.heightAt(x, z)];
      for (let edge = 0; edge < 8; edge++) {
        const angle = (edge / 8) * Math.PI * 2;
        heights.push(terrain.heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius));
      }
      const y = Math.min(...heights) - 0.1;
      const height = Math.max(radius * (0.7 + random() * 0.5), Math.max(...heights) - y + 0.35);
      rocks.push({
        x,
        y,
        z,
        radius,
        height,
        seed: 5909 + index * 173 + placements.length,
        yaw: random() * Math.PI * 2,
        detail: 1,
        tile: 0.8,
      });
      placements.push({ x, z, radius });
    }
  }
  return rocks;
}

export function buildSloughBoulders(stream: Stream, terrain: Terrain) {
  const rocks: SceneryRock[] = [];
  for (const [index, slough] of streamPools(stream).entries()) {
    const random = seededRandom(2909 + index * 137);
    const count = slough === stream.spring ? 12 : 4 + Math.floor(random() * 4);
    const placedRocks: { x: number; z: number; radius: number }[] = [];
    for (let attempt = 0; attempt < 120 && placedRocks.length < count; attempt++) {
      // The two outer pool lobes, leaving the broad river mouth open.
      const circle = slough.basin[Math.floor(random() * 2)]!;
      const angle = random() * Math.PI * 2;
      const radius = slough === stream.spring ? 1 + random() * 1.4 : 0.7 + random() * 1.1;
      const reach = circle.radius + radius * 0.8 + random() * 1.8;
      const x = circle.x + Math.cos(angle) * reach;
      const z = circle.z + Math.sin(angle) * reach;
      if (isInStream(stream, x, z, -radius - 0.8)) continue;
      if (streamPools(stream).some((pool) => basinDepthAt(pool, x, z) > -radius * 0.7)) continue;
      if (placedRocks.some((rock) => Math.hypot(x - rock.x, z - rock.z) < radius + rock.radius))
        continue;
      const height = radius * (0.65 + random() * 0.45);
      // Embed the base across its footprint, rather than floating a rock off
      // the downhill side of a slope. Reject banks too steep for this rock.
      const heights = [terrain.heightAt(x, z)];
      for (let edge = 0; edge < 8; edge++) {
        const turn = (edge / 8) * Math.PI * 2;
        heights.push(terrain.heightAt(x + Math.cos(turn) * radius, z + Math.sin(turn) * radius));
      }
      const base = Math.min(...heights);
      if (Math.max(...heights) - base > height * 0.8) continue;
      const y = base - height * 0.12;
      rocks.push({
        x,
        y,
        z,
        radius,
        height,
        seed: 3909 + index * 137 + placedRocks.length,
        yaw: random() * Math.PI * 2,
        detail: 1,
        tile: 0.8,
      });
      placedRocks.push({ x, z, radius });
    }
  }
  return rocks;
}

export function buildStreamStones(stream: Stream, terrain: Terrain) {
  const rocks: SceneryRock[] = [];
  const random = seededRandom(1414);
  const count = Math.round((stream.length / 100) * STREAM_STONES_PER_100M);
  for (let index = 0; index < count; index++) {
    const along = random() * stream.length;
    const row = Math.min(
      stream.count - 1,
      Math.round(along / (stream.length / (stream.count - 1))),
    );
    const here = streamPointAt(stream, row);
    const before = streamPointAt(stream, Math.max(0, row - 1));
    const after = streamPointAt(stream, Math.min(stream.count - 1, row + 1));
    const size = Math.hypot(after.x - before.x, after.z - before.z) || 1;
    const normalX = -(after.z - before.z) / size;
    const normalZ = (after.x - before.x) / size;
    const half = streamWaterHalfWidthAt(stream, along);
    // Mostly in the water or at its lip, a few further up the bank.
    const across = (random() * 2 - 1) * (half + 0.9);
    const x = here.x + normalX * across;
    const z = here.z + normalZ * across;
    const radius = 0.14 + random() * random() * 0.55;
    const ground = Math.max(terrain.heightAt(x, z), streamBedAt(stream, along) - 0.2);
    const y = ground + radius * 0.12;
    rocks.push({
      x,
      y,
      z,
      radius,
      height: radius * 0.6,
      seed: 1400 + index,
      yaw: random() * Math.PI * 2,
      tile: 0.5,
      detail: 0,
    });
  }
  return rocks;
}

export function streamRockColliders(stream: Stream, terrain: Terrain) {
  const shores = streamPools(stream).flatMap((pool, index) =>
    buildShoreStones(pool, terrain.heightAt, 1909 + index * 137, (x, z) =>
      isInStream(stream, x, z, -0.3),
    ),
  );
  return [
    ...buildStreamStones(stream, terrain),
    ...buildWaterfallRocks(stream, terrain),
    ...buildSloughBoulders(stream, terrain),
    ...buildSpringRocks(stream, terrain),
    ...shores,
    ...buildShoreStones(LAKE, terrain.heightAt),
  ].map((rock) =>
    surfaceCollider(rock.x, rock.y, rock.z, embeddedStonePositions(rock, terrain), rock.yaw),
  );
}

/** Low shore pebbles use their own stream of randomness, independent of plant rendering. */
export function buildShoreStones(
  lake: Lake,
  heightAt: (x: number, z: number) => number,
  seed = 909,
  excludeAt: (x: number, z: number) => boolean = () => false,
): SceneryRock[] {
  const random = seededRandom(seed + 4001),
    rocks: SceneryRock[] = [];
  for (let attempt = 0; attempt < 46 * 30 && rocks.length < 46; attempt++) {
    const circle = lake.basin[Math.floor(random() * lake.basin.length)];
    if (!circle) break;
    const angle = random() * Math.PI * 2,
      x = circle.x + Math.cos(angle) * (circle.radius + 0.1),
      z = circle.z + Math.sin(angle) * (circle.radius + 0.1);
    if (basinDepthAt(lake, x, z) > -0.05 || excludeAt(x, z)) continue;
    const radius = 0.18 + random() * 0.32;
    rocks.push({
      x,
      y: heightAt(x, z),
      z,
      radius,
      height: radius * 0.55,
      seed: 800 + rocks.length,
      yaw: random() * 3,
      tile: 0.5,
      detail: 0,
    });
  }
  return rocks;
}

/** Matches the existing buried foot deformation; the roof is left unchanged. */
export function embeddedStonePositions(rock: SceneryRock, terrain: Terrain): Float32Array {
  const positions = stonePositions(rock.radius, rock.height, rock.seed, rock.detail);
  return embedSurface(positions, rock, terrain);
}

export function embedSurface(
  positions: Float32Array,
  at: { x: number; y: number; z: number },
  terrain: Terrain,
  bandFraction = 0.35,
): Float32Array {
  let bottom = Infinity,
    top = -Infinity,
    radius = 0;
  for (let i = 1; i < positions.length; i += 3) {
    bottom = Math.min(bottom, positions[i]!);
    top = Math.max(top, positions[i]!);
  }
  const band = (top - bottom) * bandFraction;
  for (let i = 0; i < positions.length; i += 3)
    if (positions[i + 1]! <= bottom + band)
      radius = Math.max(radius, Math.hypot(positions[i]!, positions[i + 2]!));
  let lowest = terrain.heightAt(at.x, at.z);
  for (const reach of [radius, radius + 2.5])
    for (let step = 0; step < 16; step++) {
      const angle = (step / 16) * Math.PI * 2;
      lowest = Math.min(
        lowest,
        terrain.heightAt(at.x + Math.cos(angle) * reach, at.z + Math.sin(angle) * reach),
      );
    }
  const depth = Math.max(0.08, at.y + bottom - lowest + 0.08);
  for (let i = 1; i < positions.length; i += 3)
    positions[i] = positions[i]! - (1 - smoothstep(positions[i]!, bottom, bottom + band)) * depth;
  return positions;
}
