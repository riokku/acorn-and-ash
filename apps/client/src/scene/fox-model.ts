import { loadScaledModel, type ModelPart } from './model-loading';

import foxUrl from '@assets/critters/fox.glb?url';

/** A red fox's shoulder height, roughly. */
const TARGET_HEIGHT = 0.42;

let foxParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches the real fox model up front. Idempotent, so both the eager
 * kick-off at startup and an `await` before it's needed can call this
 * without loading it twice.
 */
export function preloadFoxModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real fox's parts, or undefined to keep drawing the placeholder. */
export function foxModelParts(): ModelPart[] | undefined {
  return foxParts;
}

async function load(): Promise<void> {
  try {
    foxParts = await loadScaledModel(foxUrl, TARGET_HEIGHT);
  } catch (error) {
    // The placeholder body-and-ears is a fine fallback, so a fetch failure
    // here shouldn't stop the player from getting into the world.
    console.error('Could not load the fox model; keeping the placeholder.', error);
  }
}
