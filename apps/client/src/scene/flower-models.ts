import { loadScaledModel, type ModelPart } from './model-loading';

import flowerUrl from '@assets/flowers/flower.glb?url';

/** About as tall as the stem-and-bloom placeholder it replaces. */
const TARGET_HEIGHT = 0.3;

let flowerParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches the real flower model up front. Idempotent, so both the eager
 * kick-off at startup and an `await` before it's needed can call this
 * without loading it twice. Used wherever the game draws a flower: the
 * flower patch gather spot and the flower bed's blooms.
 */
export function preloadFlowerModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real flower's parts, or undefined to keep drawing the placeholder. */
export function flowerModelParts(): ModelPart[] | undefined {
  return flowerParts;
}

async function load(): Promise<void> {
  try {
    flowerParts = await loadScaledModel(flowerUrl, TARGET_HEIGHT);
  } catch (error) {
    // The placeholder stem-and-bloom is a fine fallback, so a fetch failure
    // here shouldn't stop the player from getting into the world.
    console.error('Could not load the flower model; keeping the placeholder.', error);
  }
}
