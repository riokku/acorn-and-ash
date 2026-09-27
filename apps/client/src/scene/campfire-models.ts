import {
  loadAnimatedModel,
  loadScaledModel,
  type AnimatedModel,
  type ModelPart,
} from './model-loading';

import { createRockMaterial, createTriplanarMaterial } from '../art/materials';

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
    campfireParts = dressUp(await loadScaledModel(campfireUrl, TARGET_HEIGHT));
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

/**
 * The campfire model came with one flat colour per part; each gets the
 * painted texture it stands for instead (see decision 0053) - bark on the
 * logs, stone on the ring of rocks, and grey ash under it all. Projected on
 * from all sides, since the model has no texture layout of its own.
 */
function dressUp(parts: ModelPart[]): ModelPart[] {
  const bark = createTriplanarMaterial('bark', 0xffffff, 0.35);
  const scorched = createTriplanarMaterial('bark', 0x8a7a6c, 0.35);
  const rock = createRockMaterial({ tint: 0xd5d0c8, moss: 0.15 });
  const ash = createTriplanarMaterial('soil', 0x9a948c, 0.4, 1);
  return parts.map((part) => {
    const name = part.material.name.toLowerCase();
    const material = name.includes('barkb')
      ? scorched
      : name.includes('bark')
        ? bark
        : name.includes('rock')
          ? rock
          : name.includes('ash')
            ? ash
            : part.material;
    return { geometry: part.geometry, material };
  });
}
