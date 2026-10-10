import { describe, expect, it } from 'vitest';

import { smoothLining } from '../src/scene/dug-smoothing';

/** A flat sheet of n by n squares in the x-z plane, y up, with the middle point lifted. */
function sheet(
  n: number,
  lift: number,
): { positions: number[]; normals: number[]; indices: number[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) {
      const middle = x === n / 2 && z === n / 2;
      positions.push(x * 0.5, middle ? lift : 0, z * 0.5);
      normals.push(0, 1, 0);
    }
  const indices: number[] = [];
  const side = n + 1;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const a = z * side + x;
      indices.push(a, a + side, a + 1, a + side, a + side + 1, a + 1);
    }
  return { positions, normals, indices };
}

describe('smoothing the lining of a hole', () => {
  it('softens a step in the surface', () => {
    const surface = sheet(4, 0.5);
    const middle = (4 / 2) * 5 + 4 / 2;
    smoothLining(surface, 4);
    expect(surface.positions[middle * 3 + 1]!).toBeLessThan(0.3);
    expect(surface.positions[middle * 3 + 1]!).toBeGreaterThan(-0.05);
  });

  it('only slides the open edges of the surface along themselves', () => {
    const surface = sheet(4, 0.5);
    smoothLining(surface, 6);
    for (let z = 0; z <= 4; z++)
      for (let x = 0; x <= 4; x++) {
        if (x > 0 && x < 4 && z > 0 && z < 4) continue;
        const at = (z * 5 + x) * 3;
        // Still flat, and never pushed far outside the square the sheet started as.
        expect(surface.positions[at + 1]!).toBeCloseTo(0, 6);
        expect(surface.positions[at]!).toBeGreaterThanOrEqual(-0.15);
        expect(surface.positions[at]!).toBeLessThanOrEqual(2.15);
        expect(surface.positions[at + 2]!).toBeGreaterThanOrEqual(-0.15);
        expect(surface.positions[at + 2]!).toBeLessThanOrEqual(2.15);
      }
    // The middle of a side stays on that side.
    expect(Math.abs(surface.positions[(0 * 5 + 2) * 3 + 2]!)).toBeLessThan(0.15);
  });

  it('rounds off the square corners of the open edge', () => {
    const surface = sheet(4, 0);
    smoothLining(surface, 6);
    const corner = 0;
    expect(Math.hypot(surface.positions[corner]!, surface.positions[corner + 2]!)).toBeGreaterThan(
      0.05,
    );
  });

  it('keeps a flat surface flat, and does nothing with no passes', () => {
    const flat = sheet(4, 0);
    smoothLining(flat, 5);
    for (let i = 0; i < flat.positions.length / 3; i++)
      expect(flat.positions[i * 3 + 1]!).toBeCloseTo(0, 6);
    const bumpy = sheet(4, 0.5);
    const kept = [...bumpy.positions];
    smoothLining(bumpy, 0);
    expect(bumpy.positions).toEqual(kept);
  });

  it('points the new normals out of the surface the way its triangles face', () => {
    const surface = sheet(4, 0.3);
    smoothLining(surface, 3);
    for (let i = 0; i < surface.normals.length / 3; i++)
      expect(surface.normals[i * 3 + 1]!).toBeGreaterThan(0.5);
  });
});
