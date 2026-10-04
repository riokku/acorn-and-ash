import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  SEASONS,
  SEASON_BLEND_SHARE,
  SEASON_LENGTH_MS,
  YEAR_LENGTH_MS,
  calendarAt,
  clockShiftForSeason,
  nextSeason,
  parseSeason,
  seasonMix,
  worldStartDay,
} from '../src/sim/seasons';
import { DAY_LENGTH_MS, dayProgress } from '../src/sim/day-night';

const SEED = 0x4143_4f52;

/** The first moment of the first day of the given year-day, in this world. */
function startOfYearDay(seed: number, yearDay: number): number {
  return (yearDay - worldStartDay(seed)) * DAY_LENGTH_MS;
}

describe('the length of a year', () => {
  it('is four seasons of six game days, which is two real hours each', () => {
    expect(SEASONS).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(DAYS_PER_SEASON).toBe(6);
    expect(DAYS_PER_YEAR).toBe(24);
    expect(SEASON_LENGTH_MS).toBe(2 * 60 * 60 * 1000);
    expect(YEAR_LENGTH_MS).toBe(8 * 60 * 60 * 1000);
  });
});

describe('calendarAt', () => {
  it('begins each world on the day its seed says', () => {
    expect(calendarAt(SEED, 0).dayOfYear).toBe(worldStartDay(SEED));
  });

  it('turns the day over at midnight and not before', () => {
    const midnight = startOfYearDay(SEED, 5);
    expect(calendarAt(SEED, midnight - 1).dayOfYear).toBe(4);
    expect(calendarAt(SEED, midnight).dayOfYear).toBe(5);
    expect(calendarAt(SEED, midnight + DAY_LENGTH_MS - 1).dayOfYear).toBe(5);
  });

  it('numbers the days of a season from 1 to 6 and then moves on', () => {
    const springStart = startOfYearDay(SEED, 0);
    const days = Array.from({ length: 7 }, (_, day) =>
      calendarAt(SEED, springStart + day * DAY_LENGTH_MS + 1),
    );
    expect(days.slice(0, 6).map((calendar) => calendar.dayOfSeason)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(days.slice(0, 6).every((calendar) => calendar.season === 'spring')).toBe(true);
    expect(days[6]).toMatchObject({ season: 'summer', dayOfSeason: 1 });
  });

  it('goes round spring, summer, autumn, winter and back to spring in a new year', () => {
    const springStart = startOfYearDay(SEED, 0);
    const seen = SEASONS.map(
      (_, index) => calendarAt(SEED, springStart + index * SEASON_LENGTH_MS + 1).season,
    );
    expect(seen).toEqual([...SEASONS]);

    const nextYear = calendarAt(SEED, springStart + YEAR_LENGTH_MS + 1);
    expect(nextYear.season).toBe('spring');
    expect(nextYear.year).toBe(calendarAt(SEED, springStart + 1).year + 1);
  });

  it('reads the same everywhere for the same world and moment', () => {
    const now = 123_456_789_012;
    expect(calendarAt(SEED, now)).toEqual(calendarAt(SEED, now));
  });

  it('gives different worlds different starting seasons, not one shared one', () => {
    const starting = new Set(
      Array.from({ length: 40 }, (_, seed) => calendarAt(seed * 7919 + 1, 0).season),
    );
    expect(starting.size).toBe(4);
  });

  it('keeps working before the clock started', () => {
    const calendar = calendarAt(SEED, -3 * DAY_LENGTH_MS - 1);
    expect(calendar.dayOfYear).toBeGreaterThanOrEqual(0);
    expect(calendar.dayOfYear).toBeLessThan(DAYS_PER_YEAR);
    expect(calendar.seasonProgress).toBeGreaterThanOrEqual(0);
    expect(calendar.seasonProgress).toBeLessThan(1);
  });

  it('reports how far through the season it is, down to the time of day', () => {
    const start = startOfYearDay(SEED, 0);
    expect(calendarAt(SEED, start).seasonProgress).toBeCloseTo(0);
    expect(calendarAt(SEED, start + SEASON_LENGTH_MS / 2).seasonProgress).toBeCloseTo(0.5);
    expect(calendarAt(SEED, start + SEASON_LENGTH_MS - 1).seasonProgress).toBeLessThan(1);
  });
});

describe('seasonMix', () => {
  const springStart = startOfYearDay(SEED, 0);
  const mixAt = (progress: number) =>
    seasonMix(calendarAt(SEED, springStart + progress * SEASON_LENGTH_MS));

  it('is purely the season for most of it', () => {
    expect(mixAt(0)).toEqual({ from: 'spring', to: 'summer', amount: 0 });
    expect(mixAt(1 - SEASON_BLEND_SHARE - 0.01).amount).toBe(0);
  });

  it('eases into the next season over the last stretch, rising steadily', () => {
    const amounts = [0.78, 0.84, 0.9, 0.96].map((progress) => mixAt(progress).amount);
    expect(amounts[0]).toBeGreaterThan(0);
    for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThan(amounts[i - 1]!);
    expect(amounts.at(-1)).toBeLessThanOrEqual(1);
  });

  it('has no jump at the turn of the season', () => {
    const justBefore = mixAt(1 - 1e-6);
    const justAfter = seasonMix(calendarAt(SEED, springStart + SEASON_LENGTH_MS));
    expect(justBefore.amount).toBeCloseTo(1, 3);
    // Wholly summer a moment ago, wholly summer now.
    expect(justBefore.to).toBe(justAfter.from);
    expect(justAfter.amount).toBe(0);
  });

  it('leads winter back round to spring', () => {
    expect(nextSeason('winter')).toBe('spring');
    expect(nextSeason('spring')).toBe('summer');
  });
});

describe('parseSeason', () => {
  it('understands a season name however it is written', () => {
    expect(parseSeason('winter')).toBe('winter');
    expect(parseSeason(' Autumn ')).toBe('autumn');
    expect(parseSeason('SPRING')).toBe('spring');
  });

  it('says there is no such season otherwise', () => {
    expect(parseSeason('monsoon')).toBeUndefined();
    expect(parseSeason('')).toBeUndefined();
    expect(parseSeason(null)).toBeUndefined();
  });
});

describe('clockShiftForSeason', () => {
  const now = 98_765_432_100;

  it.each(SEASONS)('lands on the first day of %s', (season) => {
    const shifted = calendarAt(SEED, now + clockShiftForSeason(SEED, now, season));
    expect(shifted.season).toBe(season);
    expect(shifted.dayOfSeason).toBe(1);
  });

  it('can land on a later day of the season', () => {
    const shifted = calendarAt(SEED, now + clockShiftForSeason(SEED, now, 'winter', 4));
    expect(shifted).toMatchObject({ season: 'winter', dayOfSeason: 4 });
  });

  it('moves the clock a whole number of days, so the time of day is the same', () => {
    const shift = clockShiftForSeason(SEED, now, 'summer');
    expect(shift % DAY_LENGTH_MS).toBe(0);
    expect(dayProgress(now + shift)).toBeCloseTo(dayProgress(now));
  });

  it('does nothing when it is already that day', () => {
    const today = calendarAt(SEED, now);
    expect(clockShiftForSeason(SEED, now, today.season, today.dayOfSeason)).toBe(0);
  });
});
