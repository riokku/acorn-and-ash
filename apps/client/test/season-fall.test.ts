import { describe, expect, it } from 'vitest';

import { SEASONS } from '@acorn/shared';

import { FALL_OF_SEASON, fallFor, rainShareFor } from '../src/art/season-fall';

describe('what drifts through the air', () => {
  it('has a different thing for every season', () => {
    const kinds = SEASONS.map((season) => FALL_OF_SEASON[season]);
    expect(new Set(kinds).size).toBe(SEASONS.length);
  });

  it('is petals in spring, pollen in summer, leaves in autumn and snow in winter', () => {
    expect(FALL_OF_SEASON).toEqual({
      spring: 'petals',
      summer: 'pollen',
      autumn: 'leaves',
      winter: 'snow',
    });
  });
});

describe('fallFor', () => {
  it('is only the season own thing when nothing is blended in', () => {
    expect(fallFor({ from: 'autumn', to: 'winter', amount: 0 })).toEqual({
      petals: 0,
      pollen: 0,
      leaves: 1,
      snow: 0,
    });
  });

  it('is only the next season thing at the end of the blend', () => {
    expect(fallFor({ from: 'autumn', to: 'winter', amount: 1 })).toEqual({
      petals: 0,
      pollen: 0,
      leaves: 0,
      snow: 1,
    });
  });

  it('trades one for the other halfway through, with leaves still falling as the first snow comes', () => {
    const halfway = fallFor({ from: 'autumn', to: 'winter', amount: 0.5 });
    expect(halfway.leaves).toBeCloseTo(0.5);
    expect(halfway.snow).toBeCloseTo(0.5);
    expect(halfway.petals).toBe(0);
    expect(halfway.pollen).toBe(0);
  });

  it('always adds up to exactly one pool, so the air is never empty or crowded between seasons', () => {
    for (const from of SEASONS) {
      const to = SEASONS[(SEASONS.indexOf(from) + 1) % SEASONS.length]!;
      for (let step = 0; step <= 10; step++) {
        const amounts = fallFor({ from, to, amount: step / 10 });
        const total = amounts.petals + amounts.pollen + amounts.leaves + amounts.snow;
        expect(total).toBeCloseTo(1);
      }
    }
  });

  it('shows no jump from the end of one season into the start of the next', () => {
    expect(fallFor({ from: 'winter', to: 'spring', amount: 1 })).toEqual(
      fallFor({ from: 'spring', to: 'summer', amount: 0 }),
    );
  });
});

describe('rainShareFor', () => {
  it('lets all the rain show from spring to autumn', () => {
    expect(rainShareFor({ from: 'spring', to: 'summer', amount: 0.7 })).toBe(1);
    expect(rainShareFor({ from: 'summer', to: 'autumn', amount: 1 })).toBe(1);
    expect(rainShareFor({ from: 'autumn', to: 'winter', amount: 0 })).toBe(1);
  });

  it('hands the rain over to snow as winter arrives, and has none in winter', () => {
    expect(rainShareFor({ from: 'autumn', to: 'winter', amount: 0.25 })).toBeCloseTo(0.5);
    expect(rainShareFor({ from: 'autumn', to: 'winter', amount: 0.5 })).toBe(0);
    expect(rainShareFor({ from: 'winter', to: 'spring', amount: 0 })).toBe(0);
  });

  it('brings the rain back as winter leaves', () => {
    expect(rainShareFor({ from: 'winter', to: 'spring', amount: 0.75 })).toBeCloseTo(0.5);
    expect(rainShareFor({ from: 'winter', to: 'spring', amount: 1 })).toBe(1);
  });
});
