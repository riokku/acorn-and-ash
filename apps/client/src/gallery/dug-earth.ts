import * as THREE from 'three/webgpu';

import { createFlatTerrain, type Dig } from '@acorn/shared';

import { installBvhRaycasting } from '../scene/bvh';
import { createDigScene } from '../scene/digging';

/**
 * A trench six metres deep, cut with the same code the shovel uses, so the
 * layers painted on tunnel walls can be looked at in the art gallery
 * (`?gallery=dug-earth`, decision 0114). It floats a little above the gallery's
 * ground: the ground itself is not cut away here.
 */

/** Trench size in whole dig slabs: along (1 m each), across (1.5 m each) and down (2 m each). */
const SLABS_ALONG = 6;
const SLABS_ACROSS = 3;
const SLABS_DOWN = 3;

export function createDugEarth(): { group: THREE.Group } {
  // The wall meshes build the camera's raycast index, which the game sets up at start.
  installBvhRaycasting();
  const terrain = createFlatTerrain(0);
  const scene = createDigScene(terrain, { origin: -150, cell: 2.5, hide: () => undefined });
  const digs: Dig[] = [];
  for (let down = 0; down < SLABS_DOWN; down++) {
    for (let across = 0; across < SLABS_ACROSS; across++) {
      for (let along = 0; along < SLABS_ALONG; along++) {
        digs.push({ ix: along * 2, iy: -12 + down * 4, iz: (across - 1) * 3, dir: 0 });
      }
    }
  }
  scene.apply(digs);

  const group = new THREE.Group();
  scene.group.position.set(-3, 6.05, 0.25);
  group.add(scene.group);
  return { group };
}
