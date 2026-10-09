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
