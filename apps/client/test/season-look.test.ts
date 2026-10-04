import { describe, expect, it } from 'vitest';

import { SEASONS } from '@acorn/shared';

import { SEASON_LOOKS, lookFor } from '../src/art/season-look';

describe('the look of each season', () => {
  it('has one for every season', () => {
    expect(Object.keys(SEASON_LOOKS).sort()).toEqual([...SEASONS].sort());
  });

  it('keeps every colour and the sun in a sensible range, so nothing goes black or blows out', () => {
    for (const look of Object.values(SEASON_LOOKS)) {
      for (const colour of [look.sky, look.light, look.ground, look.blades, look.foliage]) {
        for (const channel of colour) {
          expect(channel).toBeGreaterThan(0.4);
          expect(channel).toBeLessThan(2);
        }
      }
      expect(look.sunStrength).toBeGreaterThan(0.5);
      expect(look.sunStrength).toBeLessThan(1.5);
    }
  });

  it('puts snow on the ground in winter and nowhere else', () => {
    expect(SEASON_LOOKS.winter.snow).toBe(1);
    expect(SEASON_LOOKS.spring.snow).toBe(0);
    expect(SEASON_LOOKS.summer.snow).toBe(0);
    expect(SEASON_LOOKS.autumn.snow).toBe(0);
  });

  it('turns the grass warmer in autumn and the sky colder in winter', () => {
    const [autumnRed, , autumnBlue] = SEASON_LOOKS.autumn.blades;
    expect(autumnRed).toBeGreaterThan(autumnBlue);
    const [winterRed, , winterBlue] = SEASON_LOOKS.winter.sky;
    expect(winterBlue).toBeGreaterThan(winterRed);
  });
});

describe('lookFor', () => {
  it('is exactly the season when nothing is blended in', () => {
    expect(lookFor({ from: 'summer', to: 'autumn', amount: 0 })).toEqual(SEASON_LOOKS.summer);
  });

  it('is exactly the next season at the end of the blend', () => {
    expect(lookFor({ from: 'autumn', to: 'winter', amount: 1 })).toEqual(SEASON_LOOKS.winter);
  });

  it('meets in the middle halfway through', () => {
    const halfway = lookFor({ from: 'autumn', to: 'winter', amount: 0.5 });
    expect(halfway.snow).toBeCloseTo(0.5);
    expect(halfway.sunStrength).toBeCloseTo(
      (SEASON_LOOKS.autumn.sunStrength + SEASON_LOOKS.winter.sunStrength) / 2,
    );
    expect(halfway.ground[0]).toBeCloseTo(
      (SEASON_LOOKS.autumn.ground[0] + SEASON_LOOKS.winter.ground[0]) / 2,
    );
  });

  it('shows no jump from the end of one season into the start of the next', () => {
    expect(lookFor({ from: 'spring', to: 'summer', amount: 1 })).toEqual(
      lookFor({ from: 'summer', to: 'autumn', amount: 0 }),
    );
  });
});
