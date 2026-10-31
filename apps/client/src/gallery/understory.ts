import * as THREE from 'three/webgpu';

import { loadScaledModel, type ModelPart } from '../scene/model-loading';

import swordFernAUrl from '@assets/understory/sword-fern-a.glb?url';
import swordFernBUrl from '@assets/understory/sword-fern-b.glb?url';
import salalAUrl from '@assets/understory/salal-a.glb?url';
import mossMoundAUrl from '@assets/understory/moss-mound-a.glb?url';

/**
 * The forest-floor plants, made in Blender (tools/art/understory.py), shown in
 * the art gallery only - nothing in the game grows them yet.
 * `?gallery=understory` looks at the four of them in a row.
 */

/** Each plant at its modelled height, left to right along the row. */
const PLANTS = [
  { url: swordFernAUrl, height: 0.611, x: -2.1 },
  { url: swordFernBUrl, height: 0.412, x: -0.5 },
  { url: salalAUrl, height: 0.81, x: 1.2 },
  { url: mossMoundAUrl, height: 0.181, x: 2.6 },
] as const;

let plantParts: ModelPart[][] | undefined;
let preloadPromise: Promise<void> | null = null;

export function preloadUnderstory(): Promise<void> {
  preloadPromise ??= Promise.all(PLANTS.map((p) => loadScaledModel(p.url, p.height))).then(
    (parts) => {
      plantParts = parts;
    },
  );
  return preloadPromise;
}

/** Two sword ferns, a salal bush and a moss mound, side by side. */
export function createUnderstory(): { group: THREE.Group } {
  const group = new THREE.Group();
  PLANTS.forEach((plant, i) => {
    for (const part of plantParts?.[i] ?? []) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.x = plant.x;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  });
  return { group };
}
