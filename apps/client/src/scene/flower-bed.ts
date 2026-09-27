import * as THREE from 'three/webgpu';

import { ITEM_KINDS } from '@acorn/shared';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { flowerModelParts } from './flower-models';

/**
 * A flower bed (see decision 0053): a low planter of stained boards with a
 * handful of blooms growing in its soil. Each
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

  // A planter of stained boards, two high on each side, held at the corners
  // by square posts that stand a little proud, with dark garden soil inside.
  const boards = paintedMaterial('wood', { tint: 0xb48a66, roughness: 0.9 });
  const posts = paintedMaterial('wood', { tint: 0x8f6a4e, roughness: 0.9 });
  const soilMaterial = paintedMaterial('soil', { roughness: 1 });
  const builder = new ModelBuilder();
  const boardHeight = BOX_HEIGHT / 2;
  const thickness = 0.04;
  for (let row = 0; row < 2; row++) {
    const y = boardHeight * (row + 0.5);
    for (const side of [-1, 1]) {
      builder.add(
        boards,
        plankGeometry(BOX_WIDTH, boardHeight - 0.008, thickness, 'x', 1, 400 + row * 2 + side),
        placed(0, y, (side * (BOX_DEPTH - thickness)) / 2),
      );
      builder.add(
        boards,
        plankGeometry(
          thickness,
          boardHeight - 0.008,
          BOX_DEPTH - thickness * 2,
          'z',
          1,
          410 + row * 2 + side,
        ),
        placed((side * (BOX_WIDTH - thickness)) / 2, y, 0),
      );
    }
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      builder.add(
        posts,
        plankGeometry(0.07, BOX_HEIGHT + 0.05, 0.07, 'y', 1, 420 + x + z * 2),
        placed((x * BOX_WIDTH) / 2, (BOX_HEIGHT + 0.05) / 2, (z * BOX_DEPTH) / 2),
      );
    }
  }
  builder.add(
    soilMaterial,
    plankGeometry(BOX_WIDTH - thickness * 2, 0.04, BOX_DEPTH - thickness * 2, 'x', 0.6, 430),
    placed(0, BOX_HEIGHT - 0.04, 0),
  );
  const planter = builder.build();
  group.add(planter.group);
  disposables.push(planter);

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
