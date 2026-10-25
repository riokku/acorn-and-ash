import { afterEach, expect, it } from 'vitest';
import { advanceForestWind, forestWind, windGustAt } from '../src/art/forest-wind';
afterEach(() => {
  forestWind.seconds.value = 0;
  forestWind.strength.value = 0;
});
it('uses fixed world coordinates, bounds gusts and eases weather changes', () => {
  advanceForestWind(0.1, 1, false);
  expect(forestWind.strength.value).toBeGreaterThan(0);
  expect(forestWind.strength.value).toBeLessThan(0.1);
  const sample = windGustAt(120, -80);
  expect(windGustAt(120, -80)).toBe(sample);
  expect(sample).toBeGreaterThanOrEqual(0);
  expect(sample).toBeLessThanOrEqual(forestWind.strength.value);
  expect(forestWind.direction.value.length()).toBeCloseTo(1);
});
it('stops immediately for reduced motion, ignores invalid deltas, and bounds resume jumps', () => {
  advanceForestWind(0.1, 1, false);
  const before = forestWind.seconds.value;
  advanceForestWind(30, 1, true);
  expect(forestWind.strength.value).toBe(0);
  expect(forestWind.seconds.value).toBe(before);
  advanceForestWind(NaN, 1, false);
  expect(forestWind.seconds.value).toBe(before);
  advanceForestWind(30, 1, false);
  expect(forestWind.seconds.value - before).toBeCloseTo(0.1);
});
