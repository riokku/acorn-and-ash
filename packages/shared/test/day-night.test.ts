import { describe, expect, it } from 'vitest';

import {
  DAY_LENGTH_MS,
  NIGHT_END,
  NIGHT_START,
  dayBrightness,
  dayProgress,
  isNight,
} from '../src/sim/day-night';

describe('dayProgress', () => {
  it('is 0 at the start of the cycle', () => {
    expect(dayProgress(0)).toBe(0);
  });

  it('is 0.5 at the halfway point', () => {
    expect(dayProgress(DAY_LENGTH_MS / 2)).toBe(0.5);
  });

  it('wraps back to 0 exactly one cycle later', () => {
    expect(dayProgress(DAY_LENGTH_MS)).toBe(0);
  });

  it('keeps wrapping across many cycles', () => {
    expect(dayProgress(DAY_LENGTH_MS * 5 + DAY_LENGTH_MS / 4)).toBeCloseTo(0.25);
  });
});

describe('dayBrightness', () => {
  it('peaks at noon', () => {
    expect(dayBrightness(0.5)).toBeCloseTo(1);
  });

  it('troughs at midnight, from either side of the wrap', () => {
    expect(dayBrightness(0)).toBeCloseTo(0);
    expect(dayBrightness(1)).toBeCloseTo(0);
  });

  it('is a gradient at dawn and dusk, not a jump cut', () => {
    expect(dayBrightness(0.25)).toBeCloseTo(0.5);
    expect(dayBrightness(0.75)).toBeCloseTo(0.5);
  });
});

describe('isNight', () => {
  it('holds through midnight, from just after NIGHT_START to just before NIGHT_END', () => {
    expect(isNight(NIGHT_START)).toBe(true);
    expect(isNight(0.9)).toBe(true);
    expect(isNight(0)).toBe(true);
    expect(isNight(NIGHT_END - 0.01)).toBe(true);
  });

  it('is false the rest of the day', () => {
    expect(isNight(NIGHT_END)).toBe(false);
    expect(isNight(0.5)).toBe(false);
    expect(isNight(NIGHT_START - 0.01)).toBe(false);
  });
});
