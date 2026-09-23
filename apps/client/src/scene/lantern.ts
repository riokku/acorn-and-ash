import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

/**
 * A placeholder lantern: a thin post holding up a small glowing head. Art
 * replaces this once the mechanic around it is fun, the same as every other
 * placeholder.
 */
export interface Lantern {
  readonly group: THREE.Group;
  dispose(): void;
}

const POST_RADIUS = 0.04;
const POST_HEIGHT = 1.1;
const HEAD_SIZE = 0.22;
const GLOW_SIZE = 0.13;

export function createLantern(): Lantern {
  const group = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({
    color: BUILDABLE_KINDS.lantern.placeholderColor,
    roughness: 0.85,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffce7a,
    emissive: 0xffa93f,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });

  const postGeometry = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS * 1.3, POST_HEIGHT, 8);
  const post = new THREE.Mesh(postGeometry, postMaterial);
  post.position.y = POST_HEIGHT / 2;
  post.castShadow = true;
  group.add(post);

  const headGeometry = new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE);
  const head = new THREE.Mesh(headGeometry, postMaterial);
  head.position.y = POST_HEIGHT + HEAD_SIZE / 2;
  head.castShadow = true;
  group.add(head);

  // The warm "glass" showing through the frame, lit even as a placeholder.
  const glowGeometry = new THREE.BoxGeometry(GLOW_SIZE, GLOW_SIZE, GLOW_SIZE);
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.y = POST_HEIGHT + HEAD_SIZE / 2;
  group.add(glow);

  return {
    group,
    dispose: () => {
      postGeometry.dispose();
      headGeometry.dispose();
      glowGeometry.dispose();
      postMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}
