import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import {
  LAKE,
  POND,
  STREAM,
  FOREST_TRAILS,
  createWildernessTerrain,
  basinDepthAt,
  streamPointAt,
  streamWaterHalfWidthAt,
  type Terrain,
} from '@acorn/shared';
import { createGroundShader } from '../src/art/ground-shading';
import { createGround, type GroundLattice } from '../src/scene/wilderness';
import { refineGroundContacts } from '../src/scene/ground-contact';
import { shoreGroundCells } from '../src/scene/shore-ground';
import { installBvhRaycasting } from '../src/scene/bvh';

installBvhRaycasting();

function renderedHeight(
  ground: ReturnType<typeof createGround>,
  x: number,
  z: number,
  patches: Map<string, GroundLattice>,
): number {
  const n = 16;
  const cx = Math.floor((x - ground.origin) / ground.cell),
    cz = Math.floor((z - ground.origin) / ground.cell);
  const key = `${cx},${cz}`;
  let patch = patches.get(key);
  if (patch === undefined) {
    patch = ground.lattice!(cx, cz, n)!;
    patches.set(key, patch);
  }
  const u = ((x - ground.origin) / ground.cell - cx) * n,
    v = ((z - ground.origin) / ground.cell - cz) * n;
  const i = Math.min(n - 1, Math.floor(u)),
    j = Math.min(n - 1, Math.floor(v));
  const a = j * (n + 1) + i,
    du = u - i,
    dv = v - j;
  const y = (vertex: number) => patch.position[vertex * 3 + 1]!;
  return du + dv <= 1
    ? y(a) * (1 - du - dv) + y(a + 1) * du + y(a + n + 1) * dv
    : y(a + 1) * (1 - dv) + y(a + n + 1) * (1 - du) + y(a + n + 2) * (du + dv - 1);
}

it.each([734, 1234])(
  'matches physical ground around shores and supports digging (seed %i)',
  (seed) => {
    const terrain = createWildernessTerrain(seed);
    const ground = createGround(
      terrain,
      createGroundShader({ water: [], props: [], stream: STREAM }),
    );
    // Reuse the unchanged cell lattice across probes, as the waterfall regression does.
    const patches = new Map<string, GroundLattice>();
    const check = (name: string, x: number, z: number) =>
      expect(
        Math.abs(renderedHeight(ground, x, z, patches) - terrain.heightAt(x, z)),
        `${name} at ${x}, ${z}`,
      ).toBeLessThan(0.1);
    for (const [name, circles] of [
      ['pond', POND],
      ['lake', LAKE.basin],
      ['island', LAKE.islands.flatMap((island) => island.lobes)],
      ['slough', STREAM.sloughs.flatMap((slough) => slough.basin)],
    ] as const)
      for (const circle of circles)
        for (let step = 0; step < 64; step++) {
          for (const depth of [-1, 0, 0.4, 1, 2]) {
            const angle = (step * Math.PI * 2) / 64;
            const x = circle.x + Math.cos(angle) * (circle.radius - depth);
            const z = circle.z + Math.sin(angle) * (circle.radius - depth);
            if (name === 'lake' && Math.abs(basinDepthAt(LAKE, x, z)) > 3) continue;
            check(name, x, z);
          }
        }
    for (let row = 1; row < STREAM.count - 1; row += 3) {
      const point = streamPointAt(STREAM, row),
        next = streamPointAt(STREAM, row + 1);
      const length = Math.hypot(next.x - point.x, next.z - point.z);
      const width = streamWaterHalfWidthAt(STREAM, (row * STREAM.length) / (STREAM.count - 1));
      for (const across of [-1.1, -0.9, 0.9, 1.1])
        check(
          'river',
          point.x - ((next.z - point.z) / length) * width * across,
          point.z + ((next.x - point.x) / length) * width * across,
        );
    }
    for (const trail of FOREST_TRAILS)
      for (let point = 0; point < trail.points.length; point += 5) {
        const spot = trail.points[point]!;
        check(trail.name, spot.x, spot.z);
      }
    // Local patches add detail without raising the resolution across the entire world.
    expect(ground.mesh.geometry.getAttribute('position').count).toBeLessThan(600_000);
    const x = 61.34,
      z = -98.89;
    const cx = Math.floor((x - ground.origin) / ground.cell),
      cz = Math.floor((z - ground.origin) / ground.cell);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, terrain.heightAt(x, z) + 20, z),
      new THREE.Vector3(0, -1, 0),
      0,
      25,
    );
    const hit = ray.intersectObject(ground.mesh)[0];
    expect(hit).toBeDefined();
    expect(Math.abs(hit!.point.y - terrain.heightAt(x, z))).toBeLessThan(0.1);
    const index = ground.mesh.geometry.getIndex()!;
    // Preserve the full scan without boxing millions of indices into arrays.
    const before = index.array.slice();
    ground.hide(cx, cz);
    expect(ray.intersectObject(ground.mesh)).toHaveLength(0);
    let changedIndices = 0;
    for (let i = 0; i < before.length; i++) if (before[i] !== index.array[i]) changedIndices++;
    expect(changedIndices).toBeGreaterThan(6);
    expect(ground.lattice!(cx, cz, 50)?.position).toHaveLength(51 * 51 * 3);
    ground.dispose();
  },
  // The whole wilderness is meshed per seed on shared CI CPUs, like waterfalls.test.ts.
  30_000,
);

function geometryFor(terrain: Terrain) {
  const geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++)
    position.setZ(i, terrain.heightAt(position.getX(i), -position.getY(i)));
  return geometry;
}

it('joins different detail levels and the original mesh without gaps', () => {
  const terrain: Terrain = {
    kind: 'test',
    heightAt: (x, z) => 0.1 * x * x + 0.06 * x * z + 0.1 * z * z,
  };
  const geometry = geometryFor(terrain);
  const original = geometry.getAttribute('position');
  const details = refineGroundContacts(
    geometry,
    terrain,
    { ...STREAM, falls: [] },
    10,
    4,
    new Map([
      [5, 4],
      [6, 16],
    ]),
  );
  const coarse = details.get(5)!,
    fine = details.get(6)!;
  const position = geometry.getAttribute('position');
  for (let row = 0; row <= 16; row++) {
    const vertex = fine.vertices[row * 17]!;
    const slot = Math.min(3, Math.floor(row / 4)),
      alpha = row / 4 - slot;
    const first = coarse.vertices[slot * 5 + 4]!,
      last = coarse.vertices[(slot + 1) * 5 + 4]!;
    expect(position.getZ(vertex)).toBeCloseTo(
      position.getZ(first) * (1 - alpha) + position.getZ(last) * alpha,
      6,
    );
    if (row % 4 === 0) expect(vertex).toBe(coarse.vertices[(row / 4) * 5 + 4]);
    const outer = fine.vertices[row * 17 + 16]!;
    expect(position.getZ(outer)).toBeCloseTo(
      original.getZ(8) * (1 - row / 16) + (original.getZ(13) * row) / 16,
      6,
    );
  }
  geometry.dispose();
});

it('keeps flat shore candidates at the original resolution', () => {
  const terrain: Terrain = { kind: 'flat', heightAt: () => 0 };
  const geometry = geometryFor(terrain);
  expect(shoreGroundCells(geometry, terrain, LAKE, STREAM, 10, 4).size).toBe(0);
  geometry.dispose();
});
