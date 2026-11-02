import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

/**
 * Polyfork's free Forest Deer (decision 0272), standing in for the Roosevelt
 * elk. Polyfork's deer is 1.5 m tall at the antlers; grown evenly to our
 * elk's size, since a Roosevelt elk is a much bigger animal than a deer.
 */
const ELK_SCALE = 1.6;
const deer = polyforkAnimal('forest-deer', {
  walkSpeed: 0.9 * ELK_SCALE,
  runSpeed: 4.5 * ELK_SCALE,
  scale: ELK_SCALE,
});

/** Fetches the deer up front. Idempotent, like the other model preloads. */
export function preloadDeerModel(): Promise<void> {
  return deer.preload();
}

/** A living copy of the real deer, or undefined to keep drawing the placeholder elk. */
export function createDeerModel(): AnimatedAnimal | undefined {
  return deer.create();
}
