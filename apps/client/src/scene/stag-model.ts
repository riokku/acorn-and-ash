import { riggedAnimal, type AnimatedAnimal } from './polyfork-animal';

import stagUrl from '@assets/critters/stag.glb?url';

/**
 * The Old Cedar Stag: Quaternius's CC0 Stag, with its own Idle, Walk and
 * Gallop. The pack draws it 5.4 m to the antler tips; shrunk evenly to a
 * great old stag about 2.4 m tall, a head above the elk.
 */
const STAG_SCALE = 0.45;
const stag = riggedAnimal(stagUrl, 'stag', {
  walkSpeed: 1.2,
  runSpeed: 6,
  scale: STAG_SCALE,
  runClip: 'Gallop',
});

/** Fetches the stag up front. Idempotent, like the other model preloads. */
export function preloadStagModel(): Promise<void> {
  return stag.preload();
}

/** A living copy of the stag, or undefined to keep drawing the old elk figure. */
export function createStagModel(): AnimatedAnimal | undefined {
  return stag.create();
}
