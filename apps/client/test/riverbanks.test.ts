import * as THREE from 'three/webgpu';
import { STREAM, streamPointAt, streamWaterHalfWidthAt, createFlatTerrain } from '@acorn/shared';
import { expect, it } from 'vitest';
import { createGroundShader } from '../src/art/ground-shading';
import { createGround } from '../src/scene/wilderness';

it('keeps sandy shores and subdivided ground within WebGPU vertex-buffer limits', () => {
  const ground = createGround(
    createFlatTerrain(),
    createGroundShader({ water: [], props: [], stream: STREAM }),
  );
  const buffers = new Set(
    Object.values(ground.mesh.geometry.attributes).map((attribute) =>
      attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data : attribute,
    ),
  );
  expect(buffers.size).toBeLessThanOrEqual(8);
  const lattice = ground.lattice!(0, 0, 2)!;
  expect(lattice.bank).toHaveLength(18);
  ground.dispose();
});

it('fades damp sand through the bank into grass and leaves steep faces unsanded', () => {
  const shader = createGroundShader({ water: [], props: [], stream: STREAM });
  const row = Math.round(STREAM.count * 0.3);
  const point = streamPointAt(STREAM, row);
  const next = streamPointAt(STREAM, row + 1);
  const dx = next.x - point.x,
    dz = next.z - point.z,
    length = Math.hypot(dx, dz);
  const width = streamWaterHalfWidthAt(STREAM, (row * STREAM.length) / (STREAM.count - 1));
  const sample = (gap: number, slope = 0) =>
    shader.shadeAt(
      point.x - (dz / length) * (width + gap),
      point.z + (dx / length) * (width + gap),
      slope,
    );
  const wet = sample(0),
    dry = sample(1.5),
    grass = sample(5);
  expect(wet.bank[0]).toBeGreaterThan(dry.bank[0]);
  expect(dry.bank[0]).toBeGreaterThan(grass.bank[0]);
  expect(wet.bank[1]).toBeGreaterThan(dry.bank[1]);
  expect(wet.floor).toBeGreaterThan(0.95);
  expect(grass.bank[0]).toBe(0);
  expect(sample(0, 1.2).bank[0]).toBe(0);
});
