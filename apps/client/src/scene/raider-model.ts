import type { RaiderKindId } from '@acorn/shared';

import { loadAnimatedModel, type AnimatedModel } from './model-loading';

import minionUrl from '@assets/raiders/skeleton-minion.glb?url';
import rogueUrl from '@assets/raiders/skeleton-rogue.glb?url';
import warriorUrl from '@assets/raiders/skeleton-warrior.glb?url';
import mageUrl from '@assets/raiders/skeleton-mage.glb?url';

/**
 * Every skeleton's model (see assets/LICENSES.csv). They are rigged on the
 * same skeleton as the players' characters, so they play the very same
 * moves from the shared animation library (see character-animations.ts).
 */
const MODEL_URLS: Record<RaiderKindId, string> = {
  minion: minionUrl,
  rogue: rogueUrl,
  warrior: warriorUrl,
  sentinel: warriorUrl,
  mage: mageUrl,
};

const templates = new Map<RaiderKindId, AnimatedModel>();
let preloadPromise: Promise<void> | null = null;

/** Fetches every skeleton up front. Safe to call as often as you like. */
export function preloadRaiderModels(): Promise<void> {
  preloadPromise ??= loadAll();
  return preloadPromise;
}

/** This skeleton's model, or undefined while it is on its way (or failed to load). */
export function raiderModelTemplate(kind: RaiderKindId): AnimatedModel | undefined {
  return templates.get(kind);
}

async function loadAll(): Promise<void> {
  await Promise.all(
    (Object.entries(MODEL_URLS) as Array<[RaiderKindId, string]>)
      .filter(([kind]) => kind !== 'sentinel')
      .map(async ([kind, url]) => {
        try {
          templates.set(kind, await loadAnimatedModel(url));
        } catch (error) {
          // A raider with no model is drawn as a plain stand-in instead (see
          // raiders.ts), so a failed fetch never hides a fight.
          console.error(`Could not load the skeleton model for "${kind}".`, error);
        }
      }),
  );
  const warrior = templates.get('warrior');
  if (warrior !== undefined) templates.set('sentinel', warrior);
}
