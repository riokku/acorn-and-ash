import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

/**
 * Polyfork's free Mountain hare (decision 0272), standing in for the
 * jackrabbit: long ears and long legs, a little bigger than the rabbit. It
 * is white, like a hare in its winter coat.
 */
const HARE_SCALE = 1.1;
const hare = polyforkAnimal('mountain-hare', {
  walkSpeed: 1.1 * HARE_SCALE,
  runSpeed: 6 * HARE_SCALE,
  scale: HARE_SCALE,
});

/** Fetches the hare up front. Idempotent, like the other model preloads. */
export function preloadHareModel(): Promise<void> {
  return hare.preload();
}

/** A living copy of the real hare, or undefined to keep drawing the grown rabbit. */
export function createHareModel(): AnimatedAnimal | undefined {
  return hare.create();
}
