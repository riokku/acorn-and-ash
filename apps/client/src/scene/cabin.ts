import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

/**
 * A placeholder cabin: a box with a pyramid roof, big enough to read as a
 * building rather than a prop. Art replaces this once the mechanic around it
 * is fun, the same as every other placeholder.
 */
export interface Cabin {
  readonly group: THREE.Group;
  dispose(): void;
}

const WALL_WIDTH = 5;
const WALL_DEPTH = 5;
const WALL_HEIGHT = 3;
const ROOF_RADIUS = 3.9;
const ROOF_HEIGHT = 2.2;
const DOOR_WIDTH = 1;
const DOOR_HEIGHT = 2;

export function createCabin(): Cabin {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.cabin.placeholderColor,
    roughness: 0.9,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2013, roughness: 0.9 });

  const wallGeometry = new THREE.BoxGeometry(WALL_WIDTH, WALL_HEIGHT, WALL_DEPTH);
  const walls = new THREE.Mesh(wallGeometry, wallMaterial);
  walls.position.y = WALL_HEIGHT / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // A four-sided cone reads as a pyramid roof at a fraction of the geometry
  // a real hipped roof would need, and rotating it an eighth-turn puts a flat
  // face forward instead of an edge.
  const roofGeometry = new THREE.ConeGeometry(ROOF_RADIUS, ROOF_HEIGHT, 4);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = WALL_HEIGHT + ROOF_HEIGHT / 2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Just a darker rectangle on the front face, so it reads as a way in rather
  // than a blank box, without needing an actual opening yet.
  const doorGeometry = new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT);
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.set(0, DOOR_HEIGHT / 2, WALL_DEPTH / 2 + 0.01);
  group.add(door);

  return {
    group,
    dispose: () => {
      wallGeometry.dispose();
      roofGeometry.dispose();
      doorGeometry.dispose();
      wallMaterial.dispose();
      roofMaterial.dispose();
      doorMaterial.dispose();
    },
  };
}
