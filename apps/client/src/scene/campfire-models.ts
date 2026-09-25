import {
  loadAnimatedModel,
  loadScaledModel,
  type AnimatedModel,
  type ModelPart,
} from './model-loading';

import campfireUrl from '@assets/buildables/campfire.glb?url';
import flameUrl from '@assets/buildables/flame.glb?url';

/** As tall as the logs' crossing point in the placeholder it replaces. */
const TARGET_HEIGHT = 0.34;

let campfireParts: ModelPart[] | undefined;
let flameTemplate: AnimatedModel | undefined;
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches the real campfire base and flame models up front. Idempotent, so
 * both the eager kick-off at startup and an `await` before one is needed can
 * call this without loading twice.
 */
export function preloadCampfireModels(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real campfire base's parts, or undefined to keep drawing the placeholder. */
export function campfireModelParts(): ModelPart[] | undefined {
  return campfireParts;
}

/** The flame's animation template, or undefined if it hasn't loaded (no flame is drawn then). */
export function flameModelTemplate(): AnimatedModel | undefined {
  return flameTemplate;
}

async function load(): Promise<void> {
  try {
    campfireParts = await loadScaledModel(campfireUrl, TARGET_HEIGHT);
  } catch (error) {
    // The placeholder logs-and-base are a fine fallback, so a fetch failure
    // here shouldn't stop the player from getting into the world.
    console.error('Could not load the campfire model; keeping the placeholder.', error);
  }
  try {
    flameTemplate = await loadAnimatedModel(flameUrl);
  } catch (error) {
    // No placeholder flame exists - an unlit-looking campfire that still works
    // is a fine fallback, so a fetch failure here shouldn't block the world.
    console.error('Could not load the flame model; lit campfires will show no flame.', error);
  }
}
