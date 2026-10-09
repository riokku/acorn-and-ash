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

  it('leaves the open edges of the surface where they are', () => {
    const surface = sheet(4, 0.5);
    const before = [...surface.positions];
    smoothLining(surface, 6);
    for (let z = 0; z <= 4; z++)
      for (let x = 0; x <= 4; x++) {
        if (x > 0 && x < 4 && z > 0 && z < 4) continue;
        const at = (z * 5 + x) * 3;
        expect(surface.positions.slice(at, at + 3)).toEqual(before.slice(at, at + 3));
      }
  });

  it('does nothing to a surface that is already flat, or with no passes', () => {
    const flat = sheet(4, 0);
    const before = [...flat.positions];
    smoothLining(flat, 5);
    for (let i = 0; i < before.length; i++) expect(flat.positions[i]!).toBeCloseTo(before[i]!, 6);
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
