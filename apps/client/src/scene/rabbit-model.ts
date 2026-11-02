import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

/**
 * Polyfork's free Forest Rabbit (decision 0272). Its walk and run look right
 * at a wandering rabbit's speed and a fleeing one's.
 */
const rabbit = polyforkAnimal('forest-rabbit', { walkSpeed: 1.1, runSpeed: 6 });

/** Fetches the rabbit up front. Idempotent, like the other model preloads. */
export function preloadRabbitModel(): Promise<void> {
  return rabbit.preload();
}

/** A living copy of the real rabbit, or undefined to keep drawing the placeholder. */
export function createRabbitModel(): AnimatedAnimal | undefined {
  return rabbit.create();
}
