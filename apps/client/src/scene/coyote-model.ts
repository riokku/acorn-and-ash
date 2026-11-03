import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

/**
 * Polyfork's free Wolf (decision 0272), standing in for the coyote. The wolf
 * is 1.4 m nose to tail; shrunk evenly to a coyote's 1.1 m, grey coat and all.
 */
const COYOTE_SCALE = 0.8;
const wolf = polyforkAnimal('wolf', {
  walkSpeed: 1.1 * COYOTE_SCALE,
  runSpeed: 5 * COYOTE_SCALE,
  scale: COYOTE_SCALE,
});

/** Fetches the wolf up front. Idempotent, like the other model preloads. */
export function preloadCoyoteModel(): Promise<void> {
  return wolf.preload();
}

/** A living copy of the real coyote, or undefined to keep drawing the grown fox. */
export function createCoyoteModel(): AnimatedAnimal | undefined {
  return wolf.create();
}
