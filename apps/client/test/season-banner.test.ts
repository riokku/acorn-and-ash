import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_SEASON,
  DAYS_PER_YEAR,
  DAY_LENGTH_MS,
  DEFAULT_WORLD_SEED,
  SEASONS,
  calendarAt,
  type Calendar,
} from '@acorn/shared';

import { backdropCalendar } from '../src/backdrop/backdrop-clock';
import { SEASON_NAMES, seasonBannerView, seasonIsEnding } from '../src/hud/season-banner';

const NOW = Date.UTC(2026, 9, 6, 20, 0, 0);

/** A calendar on a chosen day, so each case does not hunt for a date. */
function on(season: Calendar['season'], dayOfSeason: number, year = 1): Calendar {
  const seasonIndex = SEASONS.indexOf(season);
  return {
    season,
    seasonIndex,
    dayOfSeason,
    dayOfYear: seasonIndex * DAYS_PER_SEASON + dayOfSeason - 1,
    year,
    seasonProgress: (dayOfSeason - 1) / DAYS_PER_SEASON,
  };
}

describe('what the season banner says', () => {
  it('names the year and the season, the way Northgard does', () => {
    const view = seasonBannerView(on('autumn', 3, 2));
    expect(view.title).toBe('Year 2 · Autumn');
    expect(view.year).toBe(2);
    expect(view.seasonName).toBe('Autumn');
    expect(view.season).toBe('autumn');
  });

  it('leaves the year out where no world is known, so the home screens never print the clock year', () => {
    const view = seasonBannerView(backdropCalendar(NOW), { showYear: false });
    expect(view.year).toBeUndefined();
    expect(view.title).toBe(SEASON_NAMES[view.season]);
    expect(view.title).not.toMatch(/\d/);
  });

  it('counts the days of the season, so the stripe can be cut to match', () => {
    const view = seasonBannerView(on('spring', 4));
    expect(view.day).toBe(4);
    expect(view.daysInSeason).toBe(DAYS_PER_SEASON);
  });

  it('says where in the year it is, so the ring round the minimap can light the right piece', () => {
    const view = seasonBannerView(on('autumn', 4));
    expect(view.seasonIndex).toBe(2);
    // Spring and summer are twelve days, then three autumn days have gone.
    expect(view.dayOfYear).toBe(2 * DAYS_PER_SEASON + 3);
    expect(seasonBannerView(on('spring', 1)).dayOfYear).toBe(0);
    expect(seasonBannerView(on('winter', DAYS_PER_SEASON)).dayOfYear).toBe(DAYS_PER_YEAR - 1);
  });

  it('has a name and a line for every season', () => {
    for (const season of SEASONS) {
      const view = seasonBannerView(on(season, 1));
      expect(SEASON_NAMES[season]).not.toBe('');
      expect(view.hint.length).toBeGreaterThan(0);
    }
  });

  it('only says the lake is walkable in winter, the one thing a season changes in play', () => {
    for (const season of SEASONS) {
      const mentionsLake = /lake/i.test(seasonBannerView(on(season, 1)).hint);
      expect(mentionsLake).toBe(season === 'winter');
    }
  });

  it('turns to the next season on the last day, with a different line', () => {
    for (const season of SEASONS) {
      const early = seasonBannerView(on(season, DAYS_PER_SEASON - 1));
      const last = seasonBannerView(on(season, DAYS_PER_SEASON));
      expect(seasonIsEnding(on(season, DAYS_PER_SEASON - 1))).toBe(false);
      expect(seasonIsEnding(on(season, DAYS_PER_SEASON))).toBe(true);
      expect(last.hint).not.toBe(early.hint);
    }
  });

  it('warns autumn to prepare for winter at the end, as in the game it is modelled on', () => {
    expect(seasonBannerView(on('autumn', DAYS_PER_SEASON)).hint).toBe(
      'You should prepare for winter.',
    );
  });

  it('keeps the progress between none and all of the season, whatever the calendar says', () => {
    expect(seasonBannerView({ ...on('summer', 1), seasonProgress: -0.2 }).progress).toBe(0);
    expect(seasonBannerView({ ...on('summer', 6), seasonProgress: 1.4 }).progress).toBe(1);
    expect(seasonBannerView({ ...on('summer', 3), seasonProgress: 0.4 }).progress).toBe(0.4);
  });
});

describe('the season on the home screens', () => {
  it('is the calendar the painted backdrop follows', () => {
    expect(backdropCalendar(NOW)).toEqual(calendarAt(DEFAULT_WORLD_SEED, NOW));
  });

  it('shows the first day of a season asked for with ?season=, in every season', () => {
    for (const season of SEASONS) {
      const calendar = backdropCalendar(NOW, season);
      expect(calendar.season).toBe(season);
      expect(calendar.dayOfSeason).toBe(1);
    }
  });

  it('moves on one day at a time as the clock does', () => {
    const today = backdropCalendar(NOW).dayOfYear;
    const tomorrow = backdropCalendar(NOW + DAY_LENGTH_MS).dayOfYear;
    expect((tomorrow - today + 24) % 24).toBe(1);
  });
});
