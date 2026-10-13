import { describe, expect, it } from 'vitest';
import { createCollisionWorld, createFlatTerrain, surfaceCollider } from '@acorn/shared';
import { footGroundHeightAt } from '../src/scene/standing-foot-contact';
const top = (x: number) => 0.9 + 0.7 * x;
const roof = [
  -1,
  top(-1),
  -1,
  1,
  top(1),
  1,
  1,
  top(1),
  -1,
  -1,
  top(-1),
  -1,
  -1,
  top(-1),
  1,
  1,
  top(1),
  1,
];
const world = createCollisionWorld(createFlatTerrain(), [surfaceCollider(0, 0, 0, roof)], 100);
describe('feet on solid roofs', () => {
  it('samples the rising and falling sides of the actual facet within the foot solver range', () => {
    for (const x of [-0.2, 0, 0.2])
      expect(footGroundHeightAt(world, x, 0, 0.9)).toBeCloseTo(top(x), 5);
  });
  it('does not reach a distant high ledge or invent ground before the world arrives', () => {
    expect(footGroundHeightAt(world, 0.7, 0, 0.9)).toBe(0);
    expect(footGroundHeightAt(null, 0, 0, 0.9)).toBe(0.9);
  });
});
