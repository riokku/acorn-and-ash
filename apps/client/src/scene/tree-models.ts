import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { PROP_KINDS, propHeight, type PropKindId } from '@acorn/shared';

import birchUrl from '@assets/trees/birch.glb?url';
import oakUrl from '@assets/trees/oak.glb?url';

/**
 * Real art for a couple of tree kinds, sourced from a CC0 pack (see
 * assets/LICENSES.csv). Any kind with no entry here — pine, for now — keeps
 * drawing its placeholder shape; see the fallback in createPropMeshes.
 */
const MODEL_URLS: Partial<Record<PropKindId, string>> = {
  birch: birchUrl,
  oak: oakUrl,
};

export interface ModelPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

const modelParts = new Map<PropKindId, ModelPart[]>();
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches every real tree model up front. Idempotent, so both the eager
 * kick-off at startup and the `await` before a world is built can call this
 * without loading anything twice.
 */
export function preloadTreeModels(): Promise<void> {
  preloadPromise ??= loadAll();
  return preloadPromise;
}

/** The real model's parts for this kind, or undefined to keep the placeholder. */
export function realModelPartsFor(id: PropKindId): ModelPart[] | undefined {
  return modelParts.get(id);
}

async function loadAll(): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  await Promise.all(
    (Object.entries(MODEL_URLS) as Array<[PropKindId, string]>).map(async ([id, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        modelParts.set(id, extractParts(gltf.scene, id));
      } catch (error) {
        // The placeholder shape is a fine fallback, so a fetch failure here
        // shouldn't stop the player from getting into the world.
        console.error(`Could not load the model for "${id}"; keeping its placeholder.`, error);
      }
    }),
  );
}

/**
 * Pulls the drawable geometry out of a loaded glTF, scaled and grounded to
 * match this kind's design height instead of whatever size the source pack
 * happened to model it at. Every other prop is placed the same way — position,
 * yaw and a per-instance scale, nothing else — so baking this in here means
 * the rest of the instancing code doesn't need to know real art from a
 * placeholder cylinder.
 */
function extractParts(root: THREE.Object3D, id: PropKindId): ModelPart[] {
  const box = new THREE.Box3().setFromObject(root);
  const nativeHeight = box.max.y - box.min.y;
  const scale = nativeHeight > 0 ? propHeight(PROP_KINDS[id]) / nativeHeight : 1;
  const align = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * scale, 0));

  const parts: ModelPart[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry.applyMatrix4(align);
    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    if (material !== undefined) parts.push({ geometry, material });
  });
  return parts;
}
