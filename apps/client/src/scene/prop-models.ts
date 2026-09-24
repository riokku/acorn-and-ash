import { PROP_KINDS, propHeight, type PropKindId } from '@acorn/shared';

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
        modelParts.set(id, await loadScaledModel(url, propHeight(PROP_KINDS[id])));
      } catch (error) {
        // The placeholder shape is a fine fallback, so a fetch failure here
        // shouldn't stop the player from getting into the world.
        console.error(`Could not load the model for "${id}"; keeping its placeholder.`, error);
      }
    }),
  );
}
