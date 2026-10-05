import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';

import { createReedPatchModel } from '../src/scene/reed-models';
import { waterPlantMaterials } from '../src/scene/water-plants';

/** The tallest point of everything in a group, in the group's own space. */
function topOf(object: THREE.Object3D): number {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object).max.y;
}

it('draws mature reeds taller than the scenery reeds, and not in their green', () => {
  const model = createReedPatchModel();
  // Stands well above the water, which is itself a good way above the bed it is built from.
  expect(topOf(model.group)).toBeGreaterThan(2);

  const scenery = waterPlantMaterials();
  const colours = new Set<number>();
  model.group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    colours.add(material.color.getHex());
  });
  expect(colours.has((scenery.reed as THREE.MeshStandardMaterial).color.getHex())).toBe(false);
  expect(colours.has((scenery.reedPale as THREE.MeshStandardMaterial).color.getHex())).toBe(false);
  model.dispose();
});

it('has a tuft for every reed a bed can hold, one more showing for each left', () => {
  const model = createReedPatchModel();
  expect(model.parts).toHaveLength(6);
  model.dispose();
});
