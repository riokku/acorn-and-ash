import { expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import {
  LAKE_WADING_DEPTH,
  STREAM_WADING_DEPTH,
  STREAM,
  createWildernessTerrain,
  smoothstep,
} from '@acorn/shared';
import { depthColourRange } from '../src/art/water-depth';
import { createStreamScene } from '../src/scene/stream';

it.each([
  ['lake', LAKE_WADING_DEPTH],
  ['river', STREAM_WADING_DEPTH],
] as const)(
  'makes %s water visibly deep at its walking limit while keeping shallow water clear',
  (_, limit) => {
    const [start, end] = depthColourRange(limit);
    expect(smoothstep(limit, start, end)).toBeGreaterThan(0.8);
    expect(smoothstep(limit * 0.35, start, end)).toBe(0);
    expect(smoothstep(limit * 0.625, start, end)).toBeLessThan(0.25);
    let previous = 0;
    for (let depth = 0; depth <= limit * 2; depth += limit / 20) {
      const share = smoothstep(depth, start, end);
      expect(share).toBeGreaterThanOrEqual(previous);
      expect(share - previous).toBeLessThan(0.13);
      previous = share;
    }
  },
);

it('samples real depth across graded slough surfaces and keeps all water within WebGPU buffer limits', () => {
  const terrain = createWildernessTerrain(1234),
    river = createStreamScene(STREAM, terrain);
  const water = river.group.getObjectByName('stream-water') as THREE.Mesh;
  const check = (mesh: THREE.Mesh) => {
    const geometry = mesh.geometry,
      positions = geometry.getAttribute('position'),
      depth = geometry.getAttribute('waterDepth');
    expect(depth).toBeDefined();
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex) + mesh.position.x,
        z = positions.getZ(vertex) + mesh.position.z,
        y = positions.getY(vertex) + mesh.position.y;
      expect(depth.getX(vertex)).toBeCloseTo(Math.max(0, y - terrain.heightAt(x, z)), 4);
    }
    const buffers = new Set(
      Object.values(geometry.attributes).map((attribute) =>
        attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data : attribute,
      ),
    );
    expect(buffers.size).toBeLessThanOrEqual(8);
  };
  check(water);
  for (const [index] of STREAM.sloughs.entries()) {
    const slough = river.group.getObjectByName(`slough-${index + 1}`)!;
    let checked = 0;
    slough.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        (child.material as THREE.Material).name === 'painted-water'
      ) {
        check(child);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(0);
  }
  river.dispose();
});
