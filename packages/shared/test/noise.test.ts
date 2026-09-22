import { describe, expect, it } from 'vitest';

import { fractalNoise2D, valueNoise2D } from '../src/world/noise';

describe('deterministic 2D noise', () => {
  it('gives the same answer for the same (seed, x, z), asked in any order', () => {
    const a = valueNoise2D(4242, 12.5, -7.25);
    const b = valueNoise2D(4242, 12.5, -7.25);
    expect(a).toBe(b);

    // Asking for a distant point first, and never asking for it again, must
    // not change the answer for this one: there is no sequence to disturb.
    valueNoise2D(4242, 9001, 9001);
    expect(valueNoise2D(4242, 12.5, -7.25)).toBe(a);
  });

  it('changes when the seed changes', () => {
    const a = valueNoise2D(1, 12.5, -7.25);
    const b = valueNoise2D(2, 12.5, -7.25);
    expect(a).not.toBe(b);
  });

  it('stays inside [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const x = (i - 250) * 3.7;
      const z = (i - 250) * -1.3;
      const value = valueNoise2D(777, x, z);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);

      const fractal = fractalNoise2D(777, x * 0.05, z * 0.05);
      expect(fractal).toBeGreaterThanOrEqual(0);
      expect(fractal).toBeLessThan(1);
    }
  });

  it('is continuous: a tiny step barely moves the answer', () => {
    const points: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [5.5, -3.2],
      [-40.1, 12.9],
      [100, 100],
    ];
    for (const [x, z] of points) {
      const here = valueNoise2D(99, x, z);
      const nearby = valueNoise2D(99, x + 0.001, z);
      expect(Math.abs(nearby - here)).toBeLessThan(0.01);
    }
  });

  it('does not just repeat the first octave at a different scale', () => {
    // A regression guard for the "every octave hashed the same way" bug: if
    // every octave used the same seed, fractal noise would just be a scaled
    // copy of valueNoise2D, and this would come out at (or very near) zero.
    const seed = 55;
    let totalDifference = 0;
    for (let i = 0; i < 50; i++) {
      const x = i * 2.1;
      const z = i * -1.7;
      totalDifference += Math.abs(fractalNoise2D(seed, x, z) - valueNoise2D(seed, x, z));
    }
    expect(totalDifference).toBeGreaterThan(1);
  });
});
