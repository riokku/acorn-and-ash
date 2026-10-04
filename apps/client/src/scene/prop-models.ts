import * as THREE from 'three/webgpu';

import { PROP_KINDS, propHeight, type PropKindId } from '@acorn/shared';

import { createRockMaterial, paintedMaterial } from '../art/materials';
import { loadScaledModel, type ModelPart } from './model-loading';

import birchUrl from '@assets/trees/western-redcedar.glb?url';
import cedarDistantUrl from '@assets/trees/western-redcedar-distant.glb?url';
import oakUrl from '@assets/trees/sitka-spruce.glb?url';
import spruceDistantUrl from '@assets/trees/sitka-spruce-distant.glb?url';
import pineUrl from '@assets/trees/douglas-fir.glb?url';
import firDistantUrl from '@assets/trees/douglas-fir-distant.glb?url';
import boulderUrl from '@assets/rocks/boulder.glb?url';
import mossyRockUrl from '@assets/rocks/mossyRock.glb?url';

/**
 * Original PNW tree meshes and licensed CC0 rocks (see
 * assets/LICENSES.csv). Any kind with no entry here keeps drawing its
 * placeholder shape; see the fallback in createPropMeshes.
 */
const MODEL_URLS: Partial<Record<PropKindId, string>> = {
  birch: birchUrl,
  oak: oakUrl,
  pine: pineUrl,
  boulder: boulderUrl,
  mossyRock: mossyRockUrl,
};

const DISTANT_URLS: Partial<Record<PropKindId, string>> = {
  pine: firDistantUrl,
  birch: cedarDistantUrl,
  oak: spruceDistantUrl,
};
const distantParts = new Map<PropKindId, ModelPart[]>();

const modelParts = new Map<PropKindId, ModelPart[]>();
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches every real prop model up front. Idempotent, so both the eager
 * kick-off at startup and the `await` before a world is built can call this
 * without loading anything twice.
 */
export function preloadPropModels(): Promise<void> {
  preloadPromise ??= loadAll();
  return preloadPromise;
}

/**
 * The needle and leaf materials of the real tree models, near and distant
 * alike. Each is shared by every tree of its kind, so changing one recolours
 * the whole forest at once, which is how the seasons tint the trees.
 */
export function treeFoliageMaterials(): THREE.MeshStandardMaterial[] {
  const found = new Set<THREE.MeshStandardMaterial>();
  for (const parts of [...modelParts, ...distantParts]) {
    const [id, list] = parts;
    if (PROP_KINDS[id].shape.family !== 'tree') continue;
    for (const part of list) {
      if (/bark/i.test(part.material.name)) continue;
      if (part.material instanceof THREE.MeshStandardMaterial) found.add(part.material);
    }
  }
  return [...found];
}

/** The real model's parts for this kind, or undefined to keep the placeholder. */
export function realModelPartsFor(id: PropKindId, distant = false): ModelPart[] | undefined {
  return distant ? (distantParts.get(id) ?? modelParts.get(id)) : modelParts.get(id);
}

async function loadAll(): Promise<void> {
  await Promise.all([
    ...Object.entries(DISTANT_URLS).map(async ([name, url]) => {
      const id = name as PropKindId;
      try {
        distantParts.set(id, dressUp(id, await loadScaledModel(url, propHeight(PROP_KINDS[id]))));
      } catch (error) {
        console.error(`Could not load distant tree ${id}.`, error);
      }
    }),
    ...(Object.entries(MODEL_URLS) as Array<[PropKindId, string]>).map(async ([id, url]) => {
      try {
        // Scaled and grounded to this kind's design height instead of
        // whatever size the source pack happened to model it at, so it drops
        // into the existing per-instance placement code with no special-casing.
        const parts = await loadScaledModel(url, propHeight(PROP_KINDS[id]));
        modelParts.set(id, dressUp(id, parts));
      } catch (error) {
        // The placeholder shape is a fine fallback, so a fetch failure here
        // shouldn't stop the player from getting into the world.
        console.error(`Could not load the model for "${id}"; keeping its placeholder.`, error);
      }
    }),
  ]);
}

/** Painted bark for the authored trees, and painted stone for the licensed rocks. */
function dressUp(id: PropKindId, parts: ModelPart[]): ModelPart[] {
  if (id === 'boulder' || id === 'mossyRock') {
    const material =
      id === 'boulder'
        ? createRockMaterial({ tint: 0xd5dadb, moss: 0.35 })
        : createRockMaterial({ tint: 0xd9d3c6, moss: 1 });
    return parts.map((part) => ({ geometry: part.geometry, material }));
  }
  if (PROP_KINDS[id].shape.family === 'tree')
    return parts.map((part) => {
      if (!/bark/i.test(part.material.name)) return part;
      part.material.dispose();
      return {
        geometry: part.geometry,
        material: paintedMaterial('bark', {
          roughness: 1,
          tint: id === 'birch' ? 0xdbb7a2 : 0xc0b5a9,
        }),
      };
    });
  return parts;
}
