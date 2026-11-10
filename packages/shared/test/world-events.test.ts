import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_SEASON,
  DAY_LENGTH_MS,
  DEFAULT_WORLD_SEED,
  POND_FISH,
  SALMON_RUN_FISH,
  SEASONS,
  WORLD_EVENTS,
  calendarAt,
  clockShiftForSeason,
  fishOnTheLine,
  fishesTheSalmonRun,
  startCast,
  worldEventOn,
  worldEventTimeLeft,
  type Calendar,
  type SeasonId,
} from '../src/index';

/** A point in a season: `days` whole days and a share of the next into it. */
function calendar(season: SeasonId, days: number): Calendar {
  const seasonIndex = SEASONS.indexOf(season);
  return {
    season,
    seasonIndex,
    dayOfSeason: Math.floor(days) + 1,
    dayOfYear: seasonIndex * DAYS_PER_SEASON + Math.floor(days),
    year: 1,
    seasonProgress: days / DAYS_PER_SEASON,
  };
}

describe('the salmon run', () => {
  it('is on for the first two days of autumn and at no other time', () => {
    expect(worldEventOn(calendar('autumn', 0))?.event).toBe(WORLD_EVENTS.salmonRun);
    expect(worldEventOn(calendar('autumn', 1.99))?.event).toBe(WORLD_EVENTS.salmonRun);
    expect(worldEventOn(calendar('autumn', 2))).toBeNull();
    expect(worldEventOn(calendar('autumn', 5.5))).toBeNull();
    for (const season of ['spring', 'summer', 'winter'] as const)
      for (let day = 0; day < DAYS_PER_SEASON; day++)
        expect(worldEventOn(calendar(season, day + 0.5))).toBeNull();
  });

  it('counts down to its end', () => {
    expect(worldEventOn(calendar('autumn', 0))!.endsInMs).toBeCloseTo(2 * DAY_LENGTH_MS);
    expect(worldEventOn(calendar('autumn', 1.5))!.endsInMs).toBeCloseTo(0.5 * DAY_LENGTH_MS);
  });

  it('begins for everyone the moment autumn does, on the real calendar', () => {
    const shift = clockShiftForSeason(DEFAULT_WORLD_SEED, 0, 'autumn');
    expect(worldEventOn(calendarAt(DEFAULT_WORLD_SEED, shift + 1000))?.event.id).toBe('salmonRun');
    expect(worldEventOn(calendarAt(DEFAULT_WORLD_SEED, shift - 1000))).toBeNull();
    expect(worldEventOn(calendarAt(DEFAULT_WORLD_SEED, shift + 2 * DAY_LENGTH_MS + 1000))).toBeNull();
  });

  it('fishes the lake, not the home pond, and only while it is on', () => {
    expect(fishesTheSalmonRun(calendar('autumn', 1), true)).toBe(true);
    expect(fishesTheSalmonRun(calendar('autumn', 1), false)).toBe(false);
    expect(fishesTheSalmonRun(calendar('autumn', 3), true)).toBe(false);
    expect(fishesTheSalmonRun(calendar('summer', 1), true)).toBe(false);
  });

  it('brings up the same fish as ever, with the good ones likelier', () => {
    const share = (table: typeof POND_FISH, item: string) =>
      table.find((row) => row.item === item)!.weight /
      table.reduce((sum, row) => sum + row.weight, 0);
    expect(SALMON_RUN_FISH.map((row) => row.item).sort()).toEqual(
      POND_FISH.map((row) => row.item).sort(),
    );
    expect(share(SALMON_RUN_FISH, 'goldenCarp')).toBeGreaterThan(share(POND_FISH, 'goldenCarp'));
    expect(share(SALMON_RUN_FISH, 'trout')).toBeGreaterThan(share(POND_FISH, 'trout'));
    expect(share(SALMON_RUN_FISH, 'goldenCarp')).toBeLessThanOrEqual(0.25);
  });

  it('lands more rare fish over many casts made during the run', () => {
    const rare = (table?: typeof POND_FISH) => {
      let count = 0;
      for (let cast = 0; cast < 2000; cast++)
        if (fishOnTheLine(DEFAULT_WORLD_SEED, cast, 100 + cast * 7, table) === 'goldenCarp') count++;
      return count;
    };
    expect(rare(SALMON_RUN_FISH)).toBeGreaterThan(rare() * 1.8);
  });

  it('carries its fish on the cast, and bites sooner', () => {
    const from = { x: 0, y: 0, z: 0 };
    const usual = startCast(DEFAULT_WORLD_SEED, 4, 500, from, { x: 1, z: 1 });
    const run = startCast(DEFAULT_WORLD_SEED, 4, 500, from, { x: 1, z: 1 }, 0.7, SALMON_RUN_FISH);
    expect(usual.fish).toBeUndefined();
    expect(run.fish).toBe(SALMON_RUN_FISH);
    expect(run.biteTick - 500).toBeLessThan(usual.biteTick - 500);
  });

  it('says how long is left in real minutes', () => {
    expect(worldEventTimeLeft(2 * DAY_LENGTH_MS)).toBe('Ends in 40 minutes');
    expect(worldEventTimeLeft(61_000)).toBe('Ends in 2 minutes');
    expect(worldEventTimeLeft(20_000)).toBe('Ends in a minute');
  });
});
