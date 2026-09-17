import { describe, expect, it } from 'vitest';

import { createRng, hashSeed } from '../src/rng';

describe('seeded randomness', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const first = Array.from({ length: 20 }, () => a.nextFloat());
    const second = Array.from({ length: 20 }, () => b.nextFloat());
    expect(first).toEqual(second);
  });

  it('gives a different sequence for a different seed', () => {
    const a = createRng(1234);
    const b = createRng(1235);
    expect(a.nextFloat()).not.toBe(b.nextFloat());
  });

  it('stays inside its range', () => {
    const rng = createRng(99);
    for (let i = 0; i < 500; i++) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(rng.nextInt(7)).toBeLessThan(7);
      const ranged = rng.nextRange(-3, 5);
      expect(ranged).toBeGreaterThanOrEqual(-3);
      expect(ranged).toBeLessThan(5);
    }
  });

  it('hashes words and numbers to a stable seed', () => {
    expect(hashSeed('home-clearing', 7)).toBe(hashSeed('home-clearing', 7));
    expect(hashSeed('home-clearing', 7)).not.toBe(hashSeed('home-clearing', 8));
    expect(hashSeed('a', 'b')).not.toBe(hashSeed('ab'));
  });
});
