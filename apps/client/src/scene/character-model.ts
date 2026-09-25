import { loadAnimatedModel, type AnimatedModel } from './model-loading';

import knightUrl from '@assets/characters/knight.glb?url';

let template: AnimatedModel | undefined;
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches the Knight model up front - the first of six characters, standing
 * in for all of them until a character-picker menu exists. Idempotent, so
 * both the eager kick-off at startup and an `await` before it's needed can
 * call this without loading it twice.
 */
export function preloadCharacterModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real character's mesh, skeleton and clips, or undefined to keep drawing the capsule. */
export function characterModelTemplate(): AnimatedModel | undefined {
  return template;
}

async function load(): Promise<void> {
  try {
    template = await loadAnimatedModel(knightUrl);
  } catch (error) {
    // The placeholder capsule is a fine fallback, so a fetch failure here
    // shouldn't stop the player from getting into the world.
    console.error('Could not load the character model; keeping the placeholder.', error);
  }
}
