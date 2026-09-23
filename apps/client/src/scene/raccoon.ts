import * as THREE from 'three/webgpu';

import { ANIMAL_KINDS } from '@acorn/shared';

/**
 * A placeholder masked raccoon: a chunkier body than the rabbit's, a dark
 * band across the face for the mask it's named for, and a ringed tail. Art
 * replaces this once the mechanic around it is fun, the same as every other
 * placeholder.
 */
export interface Raccoon {
  readonly group: THREE.Group;
  dispose(): void;
}

const BODY_LENGTH = 0.36;
const BODY_RADIUS = 0.18;
const MASK_COLOR = 0x1f1a16;
const TAIL_LENGTH = 0.3;
const TAIL_RADIUS = 0.09;
const RING_COLOR = 0xcdc3b4;

export function createRaccoon(): Raccoon {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: ANIMAL_KINDS.maskedRaccoon.placeholderColor,
    roughness: 0.9,
  });
  const maskMaterial = new THREE.MeshStandardMaterial({ color: MASK_COLOR, roughness: 0.85 });
  const ringMaterial = new THREE.MeshStandardMaterial({ color: RING_COLOR, roughness: 0.85 });

  const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 4, 8);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  // Lying on its side, pointed down -Z, the same convention every placeholder
  // animal uses to match the way facing itself works.
  body.rotation.x = Math.PI / 2;
  body.position.y = BODY_RADIUS + 0.06;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // A dark band across the front of the face - the mask it is named for.
  const maskGeometry = new THREE.BoxGeometry(BODY_RADIUS * 1.9, BODY_RADIUS * 0.7, 0.05);
  const mask = new THREE.Mesh(maskGeometry, maskMaterial);
  mask.position.set(0, BODY_RADIUS * 1.9, BODY_LENGTH / 2 + 0.14);
  group.add(mask);

  // A ringed tail: alternating bands read clearly even as a placeholder.
  const tailGeometry = new THREE.CylinderGeometry(TAIL_RADIUS * 0.4, TAIL_RADIUS, TAIL_LENGTH, 8);
  const ringGeometry = new THREE.CylinderGeometry(TAIL_RADIUS * 0.75, TAIL_RADIUS * 0.85, 0.06, 8);
  const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
  tail.position.set(0, BODY_RADIUS + 0.1, -(BODY_LENGTH / 2 + TAIL_LENGTH * 0.35));
  tail.rotation.x = Math.PI / 2.4;
  tail.castShadow = true;
  group.add(tail);

  for (const offset of [0.06, 0.16]) {
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, BODY_RADIUS + 0.1 - offset * 0.5, -(BODY_LENGTH / 2 + offset));
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
  }

  return {
    group,
    dispose: () => {
      bodyGeometry.dispose();
      maskGeometry.dispose();
      tailGeometry.dispose();
      ringGeometry.dispose();
      bodyMaterial.dispose();
      maskMaterial.dispose();
      ringMaterial.dispose();
    },
  };
}
