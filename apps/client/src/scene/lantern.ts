import * as THREE from 'three/webgpu';

import { BUILDABLE_KINDS } from '@acorn/shared';

import { createFlickerLight } from './fire-light';

/**
 * A placeholder lantern: a thin post holding up a small glowing head. Art
 * replaces this once the mechanic around it is fun, the same as every other
 * placeholder. Always lit once built - no fuel and no switch, the same
 * "atmosphere only" choice the campfire's own fire already made (see
 * decision 0033), and it matches how the glowing head already looked
 * before it actually cast any light.
 */
export interface Lantern {
  readonly group: THREE.Group;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const POST_RADIUS = 0.04;
const POST_HEIGHT = 1.1;
const HEAD_SIZE = 0.22;
const GLOW_SIZE = 0.13;

/** Smaller and closer than the campfire's - a garden lantern, not a bonfire. */
const LANTERN_LIGHT_COLOR = 0xffce7a;
const LANTERN_LIGHT_INTENSITY = 6;
const LANTERN_LIGHT_DISTANCE = 5;

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

  const fireLight = createFlickerLight(
    LANTERN_LIGHT_COLOR,
    LANTERN_LIGHT_INTENSITY,
    LANTERN_LIGHT_DISTANCE,
  );
  fireLight.light.position.copy(glow.position);
  group.add(fireLight.light);

  return {
    group,
    update: (deltaSeconds) => fireLight.update(deltaSeconds),
    dispose: () => {
      postGeometry.dispose();
      headGeometry.dispose();
      glowGeometry.dispose();
      postMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}
