import * as THREE from 'three/webgpu';

import { ANIMAL_KINDS } from '@acorn/shared';

import { foxModelParts } from './fox-model';

/**
 * A fox: real modeled art once it has loaded (see fox-model.ts), or a low
 * rust-orange body with two ears and a tail until then, the same fallback
 * every other placeholder gets before its art arrives.
 */
export interface Fox {
  readonly group: THREE.Group;
  dispose(): void;
}

const BODY_LENGTH = 0.34;
const BODY_RADIUS = 0.15;
const EAR_HEIGHT = 0.13;
const EAR_RADIUS = 0.045;
const TAIL_LENGTH = 0.32;
const TAIL_RADIUS = 0.08;

export function createFox(): Fox {
  const group = new THREE.Group();

  const realParts = foxModelParts();
  if (realParts !== undefined) {
    for (const part of realParts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // Shared geometry and material loaded once for every fox in the world,
    // so this group never owns them to dispose.
    return { group, dispose: () => {} };
  }

  const material = new THREE.MeshStandardMaterial({
    color: ANIMAL_KINDS.fox.placeholderColor,
    roughness: 0.85,
  });

  const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 4, 8);
  const body = new THREE.Mesh(bodyGeometry, material);
  body.rotation.x = Math.PI / 2;
  body.position.y = BODY_RADIUS + 0.06;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const earGeometry = new THREE.ConeGeometry(EAR_RADIUS, EAR_HEIGHT, 6);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, material);
    ear.position.set(side * 0.065, BODY_RADIUS * 2 + EAR_HEIGHT * 0.35, BODY_LENGTH / 2 + 0.08);
    ear.castShadow = true;
    group.add(ear);
  }

  const tailGeometry = new THREE.CylinderGeometry(TAIL_RADIUS * 0.3, TAIL_RADIUS, TAIL_LENGTH, 8);
  const tail = new THREE.Mesh(tailGeometry, material);
  tail.position.set(0, BODY_RADIUS + 0.12, -(BODY_LENGTH / 2 + TAIL_LENGTH * 0.35));
  tail.rotation.x = Math.PI / 2.2;
  tail.castShadow = true;
  group.add(tail);

  return {
    group,
    dispose: () => {
      bodyGeometry.dispose();
      earGeometry.dispose();
      tailGeometry.dispose();
      material.dispose();
    },
  };
}
