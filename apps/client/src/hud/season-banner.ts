/**
 * What the season banner says (decision 0110): the year, the season and a line
 * of advice, read straight off the world's calendar (decision 0089).
 *
 * Only the lake freezing changes how the game plays; the rest of the year is
 * colour and weather. So each line here either says something true about what
 * the player can do, or is about how the forest looks. Nothing promises a
 * harvest or a hardship the game doesn't have.
 */

import { DAYS_PER_SEASON, type Calendar, type SeasonId } from '@acorn/shared';

export const SEASON_NAMES: Record<SeasonId, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

/** The line under the title, said all season long. */
const SEASON_HINTS: Record<SeasonId, string> = {
  spring: 'Blossom is on the air.',
  summer: 'The forest is in full leaf.',
  autumn: 'Winter is coming. Make the most of the colour.',
  winter: 'The lake is frozen. You can walk across it.',
};

/** What replaces the line in the last days of a season, when the next one is close. */
const SEASON_ENDING_HINTS: Record<SeasonId, string> = {
  spring: 'Summer is not far off.',
  summer: 'The leaves are about to turn.',
  autumn: 'You should prepare for winter.',
  winter: 'The ice will thaw with the spring.',
};

/** Everything the banner draws, ready to print. */
export interface SeasonBannerView {
  readonly season: SeasonId;
  /** The world's year, counted from 1. Absent where no world is known (the home screens). */
  readonly year: number | undefined;
  readonly seasonName: string;
  /** Which day of the season, from 1 to `DAYS_PER_SEASON`. */
  readonly day: number;
  /** Which season of the year, from 0 for spring to 3 for winter. */
  readonly seasonIndex: number;
  /** Which day of the year, from 0 to `DAYS_PER_YEAR - 1`, for the ring round the minimap. */
  readonly dayOfYear: number;
  readonly daysInSeason: number;
  /** "Year 2 · Autumn", or just "Autumn" with no year: the title, as a screen reader says it. */
  readonly title: string;
  readonly hint: string;
  /** How far through the season, from 0 to 1, for the stripe. */
  readonly progress: number;
}

/** The last day of a season is when the next season gets a mention. */
export function seasonIsEnding(calendar: Calendar): boolean {
  return calendar.dayOfSeason >= DAYS_PER_SEASON;
}

/**
 * `showYear: false` is for the home screens. No world is chosen there, so the
 * calendar comes from the browser's clock, and that clock's "year" is a number
 * like 62201. A world's year counts from 1, so printing it would be wrong.
 */
export function seasonBannerView(
  calendar: Calendar,
  { showYear = true }: { readonly showYear?: boolean } = {},
): SeasonBannerView {
  const seasonName = SEASON_NAMES[calendar.season];
  const hints = seasonIsEnding(calendar) ? SEASON_ENDING_HINTS : SEASON_HINTS;
  return {
    season: calendar.season,
    year: showYear ? calendar.year : undefined,
    seasonName,
    day: calendar.dayOfSeason,
    seasonIndex: calendar.seasonIndex,
    dayOfYear: calendar.dayOfYear,
    daysInSeason: DAYS_PER_SEASON,
    title: showYear ? `Year ${calendar.year} · ${seasonName}` : seasonName,
    hint: hints[calendar.season],
    progress: Math.min(1, Math.max(0, calendar.seasonProgress)),
  };
}
