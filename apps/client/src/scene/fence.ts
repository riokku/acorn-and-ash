import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

/**
 * A placeholder fence: two posts and a pair of rails between them, the same
 * segment shape a player places over and over to build an actual line. Art
 * replaces this once the mechanic around it is fun, the same as every other
 * placeholder.
 */
export interface Fence {
  readonly group: THREE.Group;
  dispose(): void;
}

const SEGMENT_WIDTH = 1.4;
const POST_SIZE = 0.1;
const POST_HEIGHT = 0.7;
const RAIL_WIDTH = 0.06;
const RAIL_HEIGHT = 0.08;

export function createFence(): Fence {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.fence.placeholderColor,
    roughness: 0.9,
  });

  const postGeometry = new THREE.BoxGeometry(POST_SIZE, POST_HEIGHT, POST_SIZE);
  const postOffsets = [-SEGMENT_WIDTH / 2, SEGMENT_WIDTH / 2];
  for (const x of postOffsets) {
    const post = new THREE.Mesh(postGeometry, material);
    post.position.set(x, POST_HEIGHT / 2, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }

  const railGeometry = new THREE.BoxGeometry(SEGMENT_WIDTH - POST_SIZE, RAIL_HEIGHT, RAIL_WIDTH);
  const railHeights = [POST_HEIGHT * 0.35, POST_HEIGHT * 0.75];
  for (const y of railHeights) {
    const rail = new THREE.Mesh(railGeometry, material);
    rail.position.set(0, y, 0);
    rail.castShadow = true;
    group.add(rail);
  }

  return {
    group,
    dispose: () => {
      postGeometry.dispose();
      railGeometry.dispose();
      material.dispose();
    },
  };
}
