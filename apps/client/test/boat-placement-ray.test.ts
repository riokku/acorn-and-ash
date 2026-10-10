import { expect, it } from 'vitest';
import { groundAlongRay } from '../src/building/ground-ray';

it('aims boats at the local sloping water surface rather than the lake level or bed', () => {
  const hit = groundAlongRay(
    { x: 0, y: 10, z: 0 },
    { x: 1, y: -1, z: 0 },
    { kind: 'flat', heightAt: () => -5 },
    (x) => 2 + x * 0.2,
  )!;
  expect(hit.x).toBeCloseTo(8 / 1.2, 2);
  expect(hit.z).toBe(0);
});
