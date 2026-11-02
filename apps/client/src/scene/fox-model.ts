import { loadScaledModel, type ModelPart } from './model-loading';
import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

import foxUrl from '@assets/critters/fox.glb?url';

/** A red fox's shoulder height, roughly. */
const TARGET_HEIGHT = 0.42;

/**
 * Polyfork's free Red Fox (decision 0272), shrunk evenly from its 0.45 m
 * shoulder to ours. Its Walk is a slow, careful stalk, so it is played quick
 * to keep up with a wandering fox.
 */
const RED_FOX_SCALE = 0.93;
const redFox = polyforkAnimal('red-fox', {
  walkSpeed: 0.6 * RED_FOX_SCALE,
  runSpeed: 2.5 * RED_FOX_SCALE,
  scale: RED_FOX_SCALE,
});

let foxParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches Polyfork's fox and our own Quaternius fox up front. Idempotent, so
 * both the eager kick-off at startup and an `await` before it's needed can
 * call this without loading them twice.
 */
export function preloadFoxModel(): Promise<void> {
  preloadPromise ??= Promise.all([redFox.preload(), load()]).then(() => {});
  return preloadPromise;
}

/** A living copy of Polyfork's fox, grown by `size`, or undefined if it hasn't downloaded. */
export function createRedFoxModel(size = 1): AnimatedAnimal | undefined {
  return redFox.create(size);
}

/** The Quaternius fox's parts, or undefined to keep drawing the placeholder. */
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
