import * as THREE from 'three/webgpu';

import { ANIMAL_KINDS } from '@acorn/shared';

/**
 * A placeholder rabbit: a small body with two ears, low enough to the ground
 * to read as something that scurries rather than walks. Art replaces this
 * once the mechanic around it is fun, the same as every other placeholder.
 */
export interface Critter {
  readonly group: THREE.Group;
  dispose(): void;
}

const BODY_LENGTH = 0.32;
const BODY_RADIUS = 0.14;
const EAR_HEIGHT = 0.22;
const EAR_RADIUS = 0.035;

export function createCritter(): Critter {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: ANIMAL_KINDS.rabbit.placeholderColor,
    roughness: 0.85,
  });

  const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 4, 8);
  const body = new THREE.Mesh(bodyGeometry, material);
  // The capsule's long axis runs along Y by default; lying it on its side
  // and pointing it down -Z matches how the player's own facing works.
  body.rotation.x = Math.PI / 2;
  body.position.y = BODY_RADIUS + 0.05;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const earGeometry = new THREE.ConeGeometry(EAR_RADIUS, EAR_HEIGHT, 6);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, material);
    ear.position.set(side * 0.055, BODY_RADIUS * 2 + EAR_HEIGHT * 0.4, 0.05);
    ear.rotation.x = -0.2;
    ear.castShadow = true;
    group.add(ear);
  }

  return {
    group,
    dispose: () => {
      bodyGeometry.dispose();
      earGeometry.dispose();
      material.dispose();
    },
  };
}
