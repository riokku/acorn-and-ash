import type { CharacterId } from '@acorn/shared';

import { loadAnimatedModel, type AnimatedModel } from './model-loading';

import knightUrl from '@assets/characters/knight.glb?url';
import barbarianUrl from '@assets/characters/barbarian.glb?url';
import mageUrl from '@assets/characters/mage.glb?url';
import rangerUrl from '@assets/characters/ranger.glb?url';
import rogueUrl from '@assets/characters/rogue.glb?url';
import rogueHoodedUrl from '@assets/characters/rogueHooded.glb?url';

/** Every character's own model, one glTF per kind (see assets/LICENSES.csv). */
const MODEL_URLS: Record<CharacterId, string> = {
  knight: knightUrl,
  barbarian: barbarianUrl,
  mage: mageUrl,
  ranger: rangerUrl,
  rogue: rogueUrl,
  rogueHooded: rogueHoodedUrl,
};

const templates = new Map<CharacterId, AnimatedModel>();
let preloadPromise: Promise<void> | null = null;

/**
 * Fetches every character's model up front. Idempotent, so both the eager
 * kick-off at startup and an `await` before one's actually needed can call
 * this without loading anything twice.
 */
export function preloadCharacterModels(): Promise<void> {
  preloadPromise ??= loadAll();
  return preloadPromise;
}

/** This character's mesh, skeleton and clips, or undefined to keep drawing the capsule. */
export function characterModelTemplate(character: CharacterId): AnimatedModel | undefined {
  return templates.get(character);
}

async function loadAll(): Promise<void> {
  await Promise.all(
    (Object.entries(MODEL_URLS) as Array<[CharacterId, string]>).map(async ([id, url]) => {
      try {
        templates.set(id, await loadAnimatedModel(url));
      } catch (error) {
        // The placeholder capsule is a fine fallback, so a fetch failure here
        // shouldn't stop the player from getting into the world.
        console.error(
          `Could not load the character model for "${id}"; keeping the placeholder.`,
          error,
        );
      }
    }),
  );
}
