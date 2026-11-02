import * as THREE from 'three/webgpu';

import { loadScaledModel, type ModelPart } from './model-loading';
import { polyforkPaint, polyforkPiece, preloadPolyforkPieces } from './polyfork-piece';

import flowerUrl from '@assets/flowers/flower.glb?url';

/** About as tall as the stem-and-bloom placeholder it replaces. */
const TARGET_HEIGHT = 0.3;

/** Polyfork's free Wildflower (decision 0272) is 0.4 m tall; brought down to our flowers' height. */
const wildflower = polyforkPiece(
  'wildflower',
  new THREE.Matrix4().makeScale(TARGET_HEIGHT / 0.4, TARGET_HEIGHT / 0.4, TARGET_HEIGHT / 0.4),
);
let wildflowerParts: ModelPart[] | undefined;

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

/**
 * The real flower's parts: Polyfork's wildflower, or our Quaternius flower if
 * that didn't download, or undefined to keep drawing the placeholder.
 */
export function flowerModelParts(): ModelPart[] | undefined {
  return wildflowerParts ?? flowerParts;
}

async function load(): Promise<void> {
  await preloadPolyforkPieces();
  const plant = wildflower.parts()?.values().next().value;
  if (plant !== undefined) {
    wildflowerParts = [{ geometry: plant, material: polyforkPaint }];
    return;
  }
  try {
    flowerParts = await loadScaledModel(flowerUrl, TARGET_HEIGHT);
  } catch (error) {
    // The placeholder stem-and-bloom is a fine fallback, so a fetch failure
    // here shouldn't stop the player from getting into the world.
    console.error('Could not load the flower model; keeping the placeholder.', error);
  }
}
