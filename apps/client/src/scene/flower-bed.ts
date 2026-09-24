import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS, ITEM_KINDS } from '@acorn/shared';

import { flowerModelParts } from './flower-models';

/**
 * A flower bed: a low planter box with a handful of blooms on top. Each
 * bloom uses the real flower model once it has loaded (see
 * flower-models.ts); until then, or if it fails to load, a placeholder
 * stem-and-sphere stands in, the same as everything else does before its
 * art arrives.
 */
export interface FlowerBed {
  readonly group: THREE.Group;
  dispose(): void;
}

const BOX_WIDTH = 1.2;
const BOX_HEIGHT = 0.25;
const BOX_DEPTH = 0.8;
const BLOOM_COLORS = [ITEM_KINDS.flower.placeholderColor, 0xe8c33a, 0xd8dce8];

// A handful of small blooms, scattered across the soil rather than lined up,
// so it reads as planted rather than manufactured.
const BLOOM_OFFSETS = [
  { x: 0.35, z: 0.2 },
  { x: -0.3, z: 0.15 },
  { x: 0.05, z: -0.22 },
  { x: -0.4, z: -0.15 },
  { x: 0.32, z: -0.1 },
];

export function createFlowerBed(): FlowerBed {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const boxMaterial = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.flowerBed.placeholderColor,
    roughness: 0.95,
  });
  const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2116, roughness: 1 });
  disposables.push(boxMaterial, soilMaterial);

  const boxGeometry = new THREE.BoxGeometry(BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH);
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.position.y = BOX_HEIGHT / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  disposables.push(boxGeometry);

  const soilGeometry = new THREE.BoxGeometry(BOX_WIDTH - 0.14, 0.04, BOX_DEPTH - 0.14);
  const soil = new THREE.Mesh(soilGeometry, soilMaterial);
  soil.position.y = BOX_HEIGHT - 0.02;
  group.add(soil);
  disposables.push(soilGeometry);

  const realFlower = flowerModelParts();
  if (realFlower !== undefined) {
    // Shared geometry and material loaded once for every flower bed and
    // patch in the world, so this group never owns them to dispose.
    BLOOM_OFFSETS.forEach((offset, index) => {
      for (const part of realFlower) {
        const bloom = new THREE.Mesh(part.geometry, part.material);
        bloom.position.set(offset.x, BOX_HEIGHT, offset.z);
        bloom.rotation.y = index * 1.3;
        bloom.castShadow = true;
        group.add(bloom);
      }
    });
  } else {
    const stemGeometry = new THREE.CylinderGeometry(0.012, 0.016, 0.22, 5);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.9 });
    const headGeometry = new THREE.SphereGeometry(0.06, 6, 5);
    const headMaterials = BLOOM_COLORS.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true }),
    );
    disposables.push(stemGeometry, stemMaterial, headGeometry, ...headMaterials);

    BLOOM_OFFSETS.forEach((offset, index) => {
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.set(offset.x, BOX_HEIGHT + 0.1, offset.z);
      stem.castShadow = true;
      group.add(stem);

      const headMaterial = headMaterials[index % headMaterials.length];
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.set(offset.x, BOX_HEIGHT + 0.22, offset.z);
      head.castShadow = true;
      group.add(head);
    });
  }

  return {
    group,
    dispose: () => {
      for (const disposable of disposables) disposable.dispose();
    },
  };
}
