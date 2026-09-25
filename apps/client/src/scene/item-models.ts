import { loadScaledModel, type ModelPart } from './model-loading';

import axeUrl from '@assets/items/axe.glb?url';
import rodUrl from '@assets/items/rod.glb?url';

/** As tall as the placeholder shape each one replaces. */
const TARGET_HEIGHTS = {
  axe: 0.75,
  rod: 1.7,
} as const;

const MODEL_URLS: Record<keyof typeof TARGET_HEIGHTS, string> = {
  axe: axeUrl,
  rod: rodUrl,
};

const modelParts = new Map<keyof typeof TARGET_HEIGHTS, ModelPart[]>();
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches the real axe and rod models up front. Idempotent, so both the eager
 * kick-off at startup and the `await` before a world is built can call this
 * without loading twice.
 */
export function preloadItemModels(): Promise<void> {
  preloadPromise ??= loadAll();
  return preloadPromise;
}

/** The real model's parts for this pickup, or undefined to keep the placeholder. */
export function itemModelParts(id: keyof typeof TARGET_HEIGHTS): ModelPart[] | undefined {
  return modelParts.get(id);
}

async function loadAll(): Promise<void> {
  await Promise.all(
    (Object.entries(MODEL_URLS) as Array<[keyof typeof TARGET_HEIGHTS, string]>).map(
      async ([id, url]) => {
        try {
          modelParts.set(id, await loadScaledModel(url, TARGET_HEIGHTS[id]));
        } catch (error) {
          // The placeholder shape is a fine fallback, so a fetch failure here
          // shouldn't stop the player from getting into the world.
          console.error(`Could not load the model for "${id}"; keeping its placeholder.`, error);
        }
      },
    ),
  );
}
