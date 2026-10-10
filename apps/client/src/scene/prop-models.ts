import * as THREE from 'three/webgpu';

import { PROP_KINDS, propHeight, type PropKindId } from '@acorn/shared';

import { createRockMaterial, paintedMaterial } from '../art/materials';
import { loadScaledModel, type ModelPart } from './model-loading';

import cedarUrl from '@assets/trees/western-redcedar.glb?url';
import cedarBUrl from '@assets/trees/western-redcedar-b.glb?url';
import cedarCUrl from '@assets/trees/western-redcedar-c.glb?url';
import cedarDistantUrl from '@assets/trees/western-redcedar-distant.glb?url';
import cedarBDistantUrl from '@assets/trees/western-redcedar-b-distant.glb?url';
import cedarCDistantUrl from '@assets/trees/western-redcedar-c-distant.glb?url';
import spruceUrl from '@assets/trees/sitka-spruce.glb?url';
import spruceBUrl from '@assets/trees/sitka-spruce-b.glb?url';
import spruceCUrl from '@assets/trees/sitka-spruce-c.glb?url';
import spruceDistantUrl from '@assets/trees/sitka-spruce-distant.glb?url';
import spruceBDistantUrl from '@assets/trees/sitka-spruce-b-distant.glb?url';
import spruceCDistantUrl from '@assets/trees/sitka-spruce-c-distant.glb?url';
import firUrl from '@assets/trees/douglas-fir.glb?url';
import firBUrl from '@assets/trees/douglas-fir-b.glb?url';
import firCUrl from '@assets/trees/douglas-fir-c.glb?url';
import firDistantUrl from '@assets/trees/douglas-fir-distant.glb?url';
import firBDistantUrl from '@assets/trees/douglas-fir-b-distant.glb?url';
import firCDistantUrl from '@assets/trees/douglas-fir-c-distant.glb?url';
import boulderUrl from '@assets/rocks/boulder.glb?url';
import mossyRockUrl from '@assets/rocks/mossyRock.glb?url';

/**
 * Original PNW tree meshes and licensed CC0 rocks (see
 * assets/LICENSES.csv). Any kind with no entry here keeps drawing its
 * placeholder shape; see the fallback in createPropMeshes.
 *
 * Every kind has a list of shapes: the trees have three each so a forest is
 * not one tree stamped out many times, and each tree keeps the same shape for
 * good (see `treeVariant`).
 */
const MODEL_URLS: Partial<Record<PropKindId, readonly string[]>> = {
  birch: [cedarUrl, cedarBUrl, cedarCUrl],
  oak: [spruceUrl, spruceBUrl, spruceCUrl],
  pine: [firUrl, firBUrl, firCUrl],
  boulder: [boulderUrl],
  mossyRock: [mossyRockUrl],
};

const DISTANT_URLS: Partial<Record<PropKindId, readonly string[]>> = {
  pine: [firDistantUrl, firBDistantUrl, firCDistantUrl],
  birch: [cedarDistantUrl, cedarBDistantUrl, cedarCDistantUrl],
  oak: [spruceDistantUrl, spruceBDistantUrl, spruceCDistantUrl],
};
const distantParts = new Map<PropKindId, ModelPart[][]>();

const modelParts = new Map<PropKindId, ModelPart[][]>();
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
  for (const [id, shapes] of [...modelParts, ...distantParts]) {
    if (PROP_KINDS[id].shape.family !== 'tree') continue;
    for (const list of shapes) {
      for (const part of list) {
        if (/bark/i.test(part.material.name)) continue;
        if (part.material instanceof THREE.MeshStandardMaterial) found.add(part.material);
      }
    }
  }
  return [...found];
}

/** How many shapes of this kind there are to choose from (at least one). */
export function shapeCount(id: PropKindId): number {
  return Math.max(1, modelParts.get(id)?.length ?? 1);
}

/**
 * Which of a kind's shapes this prop wears. It depends only on the prop's id,
 * so a tree keeps its shape whenever it is drawn: near or distant, standing,
 * shaking, falling or grown back.
 */
export function treeVariant(prop: { readonly id: number; readonly kind: PropKindId }): number {
  const count = shapeCount(prop.kind);
  if (count === 1) return 0;
  // Mix the id's bits first so neighbouring ids do not take turns in order.
  return (Math.imul(prop.id, 2654435761) >>> 16) % count;
}

/** The real model's parts for this kind and shape, or undefined to keep the placeholder. */
export function realModelPartsFor(
  id: PropKindId,
  distant = false,
  variant = 0,
): ModelPart[] | undefined {
  const shapes = distant ? (distantParts.get(id) ?? modelParts.get(id)) : modelParts.get(id);
  if (shapes === undefined || shapes.length === 0) return undefined;
  return shapes[variant % shapes.length];
}

async function loadAll(): Promise<void> {
  const loadShapes = async (
    id: PropKindId,
    urls: readonly string[],
    into: Map<PropKindId, ModelPart[][]>,
  ): Promise<void> => {
    // Scaled and grounded to this kind's design height instead of whatever
    // size the source happened to model it at, so every shape drops into the
    // existing per-instance placement code with no special-casing.
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          return dressUp(id, await loadScaledModel(url, propHeight(PROP_KINDS[id])));
        } catch (error) {
          // The placeholder shape is a fine fallback, so a fetch failure here
          // shouldn't stop the player from getting into the world.
          console.error(`Could not load a model for "${id}"; skipping it.`, error);
          return null;
        }
      }),
    );
    const loaded = results.filter((parts): parts is ModelPart[] => parts !== null);
    if (loaded.length > 0) into.set(id, loaded);
  };
  await Promise.all([
    ...(Object.entries(DISTANT_URLS) as Array<[PropKindId, readonly string[]]>).map(([id, urls]) =>
      loadShapes(id, urls, distantParts),
    ),
    ...(Object.entries(MODEL_URLS) as Array<[PropKindId, readonly string[]]>).map(([id, urls]) =>
      loadShapes(id, urls, modelParts),
    ),
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
