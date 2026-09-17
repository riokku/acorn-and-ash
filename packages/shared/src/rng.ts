/**
 * Seeded randomness.
 *
 * Shared simulation code must never call `Math.random()`: the server and every
 * client have to reach the same answer from the same seed.
 */

export interface Rng {
  /** A number in [0, 1). */
  nextFloat(): number;
  /** A number in [min, max). */
  nextRange(min: number, max: number): number;
  /** A whole number in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Pick one item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

/** mulberry32: small, fast and identical everywhere. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    nextFloat,
    nextRange: (min, max) => min + nextFloat() * (max - min),
    nextInt: (maxExclusive) => Math.floor(nextFloat() * maxExclusive),
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      const item = items[Math.floor(nextFloat() * items.length)];
      // The bounds check above guarantees this is defined.
      return item as T;
    },
  };
}

/** Turn any mix of words and numbers into a stable 32-bit seed (FNV-1a). */
export function hashSeed(...parts: readonly (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = typeof part === 'number' ? part.toString(36) : part;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x2f;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
