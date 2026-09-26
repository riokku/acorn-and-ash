import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

/**
 * A placeholder garden path stone: one flattened, slightly irregular slab,
 * the same small piece a player lays over and over to trace out a trail.
 * Art replaces this once the mechanic around it is fun, the same as every
 * other placeholder.
 */
export interface GardenPath {
  readonly group: THREE.Group;
  dispose(): void;
}

const STONE_RADIUS = 0.22;
const STONE_HEIGHT = 0.05;
/** A seven-sided slab reads as a rough-cut stone rather than a perfect disc. */
const STONE_SIDES = 7;

export function createGardenPath(): GardenPath {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.gardenPath.placeholderColor,
    roughness: 1,
  });
  const geometry = new THREE.CylinderGeometry(
    STONE_RADIUS,
    STONE_RADIUS,
    STONE_HEIGHT,
    STONE_SIDES,
  );

  const stone = new THREE.Mesh(geometry, material);
  // A stone laid by hand never sits perfectly square or perfectly sized -
  // randomised once per placement so a whole trail of them doesn't read as
  // one shape stamped down repeatedly.
  stone.rotation.y = Math.random() * Math.PI * 2;
  const scale = 0.85 + Math.random() * 0.3;
  stone.scale.set(scale, 1, scale);
  stone.position.y = STONE_HEIGHT / 2;
  stone.receiveShadow = true;
  group.add(stone);

  return {
    group,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
