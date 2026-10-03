import { createRng, hashSeed } from '../rng';

/** Mature trees punctuate the canopy without changing the seeded layout or species. */
export function forestTreeScale(seed: number, x: number, z: number, ordinaryScale: number): number {
  const stature = createRng(hashSeed(seed, 'mature-tree', x, z));
  return stature.nextFloat() < 0.12 ? stature.nextRange(1.65, 2) : ordinaryScale;
}
