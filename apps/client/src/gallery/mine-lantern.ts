import * as THREE from 'three/webgpu';

import { loadScaledModel, type ModelPart } from '../scene/model-loading';

import mineLanternUrl from '@assets/buildables/mine-lantern.glb?url';

/**
 * The hanging mine lantern, made in Blender (tools/art/mine_lantern.py), shown
 * in the art gallery only - nothing in the game hangs one yet (decision 0119,
 * step 3). `?gallery=mine-lantern` looks at it up close.
 */

/** As modelled: a little over a third of a metre from hook to foot. */
const LANTERN_HEIGHT = 0.356;

let lanternParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

export function preloadMineLantern(): Promise<void> {
  preloadPromise ??= loadScaledModel(mineLanternUrl, LANTERN_HEIGHT).then((parts) => {
    lanternParts = parts;
  });
  return preloadPromise;
}

/** The lantern stood on its foot, as if set down on a bench. */
export function createMineLantern(): { group: THREE.Group } {
  const group = new THREE.Group();
  for (const part of lanternParts ?? []) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group };
}
