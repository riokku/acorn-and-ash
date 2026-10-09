import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { STREAM, createWildernessTerrain } from '@acorn/shared';
import { createStreamScene } from '../src/scene/stream';
import { waterPlantMaterials } from '../src/scene/water-plants';

it('freezes and thaws the river and all sloughs, including floating plants', () => {
  const river = createStreamScene(STREAM, createWildernessTerrain(1234));
  const floating = waterPlantMaterials();
  const pads: THREE.Mesh[] = [];
  const surfaces: THREE.Mesh[] = [];
  river.group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.material === floating.pad) pads.push(child);
    const material = child.material as THREE.Material;
    if (material.name === 'painted-water' || material.name === 'painted-ice') surfaces.push(child);
  });
  expect(pads).toHaveLength(6);
  for (const frozen of [true, false]) {
    river.setFrozen(frozen);
    expect(river.group.getObjectByName('stream-water')!.visible).toBe(!frozen);
    expect(river.group.getObjectByName('stream-ice')!.visible).toBe(frozen);
    for (const mesh of surfaces)
      expect(mesh.visible).toBe(
        (mesh.material as THREE.Material).name === 'painted-ice' ? frozen : !frozen,
      );
    for (const pad of pads) expect(pad.visible).toBe(!frozen);
  }
  river.dispose();
});

it('fits the river water into WebGPU minimum vertex-buffer limits and preserves its flow data', () => {
  const river = createStreamScene(STREAM, createWildernessTerrain(1234));
  const water = river.group.getObjectByName('stream-water') as THREE.Mesh;
  const geometry = water.geometry;
  const buffers = new Set(
    Object.values(geometry.attributes).map((attribute) =>
      attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data : attribute,
    ),
  );
  // A valid WebGPU device may expose only eight vertex buffers. Separate
  // buffers for every water attribute previously made this pipeline invalid.
  expect(buffers.size).toBeLessThanOrEqual(8);
  const flow = geometry.getAttribute('waterFlow');
  const pace = geometry.getAttribute('streamPace');
  const edge = geometry.getAttribute('streamEdge');
  const across = geometry.getAttribute('streamAcross');
  const positions = geometry.getAttribute('position');
  for (let vertex = 0; vertex < positions.count; vertex++) {
    expect(Math.hypot(flow.getX(vertex), flow.getY(vertex))).toBeCloseTo(pace.getX(vertex), 5);
    expect(geometry.getAttribute('waterFlowShare').getX(vertex)).toBe(1);
    expect(edge.getX(vertex)).toBeGreaterThanOrEqual(0);
    expect(edge.getX(vertex)).toBeLessThanOrEqual(1);
    const middle = Math.floor(vertex / 7) * 7 + 3;
    expect(Math.abs(across.getX(vertex))).toBeCloseTo(
      Math.hypot(
        positions.getX(vertex) - positions.getX(middle),
        positions.getZ(vertex) - positions.getZ(middle),
      ),
      4,
    );
  }
  river.dispose();
});
