import { PROP_KINDS, propHeight, type PropKindId } from '@acorn/shared';

import { createRockMaterial, makeLeavesCutOut } from '../art/materials';
import { loadScaledModel, type ModelPart } from './model-loading';

import birchUrl from '@assets/trees/birch.glb?url';
import oakUrl from '@assets/trees/oak.glb?url';
import pineUrl from '@assets/trees/pine.glb?url';
import boulderUrl from '@assets/rocks/boulder.glb?url';
import mossyRockUrl from '@assets/rocks/mossyRock.glb?url';

/**
 * Real art for scattered trees and rocks, sourced from CC0 packs (see
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

/** The real model's parts for this kind, or undefined to keep the placeholder. */
export function realModelPartsFor(id: PropKindId): ModelPart[] | undefined {
  return modelParts.get(id);
}

async function loadAll(): Promise<void> {
  await Promise.all(
    (Object.entries(MODEL_URLS) as Array<[PropKindId, string]>).map(async ([id, url]) => {
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
  );
}

/**
 * Touch-ups to what came in the pack (see decision 0053). Leaves become crisp
 * cut-outs - the pine's own leaf texture was exported without saying its
 * gaps are see-through, and drew them black. The two rocks came with no
 * texture at all, just one flat grey, and get painted stone instead - the
 * mossy one with the moss its name promised.
 */
function dressUp(id: PropKindId, parts: ModelPart[]): ModelPart[] {
  if (id === 'boulder' || id === 'mossyRock') {
    const material =
      id === 'boulder'
        ? createRockMaterial({ tint: 0xd5dadb, moss: 0.35 })
        : createRockMaterial({ tint: 0xd9d3c6, moss: 1 });
    return parts.map((part) => ({ geometry: part.geometry, material }));
  }
  for (const part of parts) {
    if (/leaves/i.test(part.material.name)) makeLeavesCutOut(part.material);
  }
  return parts;
}
