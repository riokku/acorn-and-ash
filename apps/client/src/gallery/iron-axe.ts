import * as THREE from 'three/webgpu';

import { loadScaledModel, type ModelPart } from '../scene/model-loading';

import ironAxeUrl from '@assets/items/iron-axe.glb?url';

/**
 * The iron axe, made in Blender (see tools/art/), shown in the art gallery
 * only - nothing in the game uses it yet. `?gallery=iron-axe` looks at it up
 * close.
 */

/** The axe at the scale the game draws the Quaternius characters at (it is 0.86 m long as modelled). */
const AXE_HEIGHT = 0.86 * 0.6;

let axeParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

export function preloadIronAxe(): Promise<void> {
  preloadPromise ??= loadScaledModel(ironAxeUrl, AXE_HEIGHT).then((parts) => {
    axeParts = parts;
  });
  return preloadPromise;
}

/** The iron axe stood upright on its haft, blade side-on to the camera. */
export function createIronAxe(): { group: THREE.Group } {
  const group = new THREE.Group();
  for (const part of axeParts ?? []) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group };
}
