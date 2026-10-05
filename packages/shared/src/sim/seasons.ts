/**
 * The seasons: a year of 24 game days, six days to a season (decision 0089).
 *
 * Like day and night, this is a pure function of the clock the server already
 * keeps. There is nothing here to save and no message to send: the server and
 * every browser work out the same season from the same time, which is what
 * keeps everyone in a world standing in the same weather of the year.
 *
 * Each world starts its year on a different day, worked out from its seed, so
 * two worlds are not always in the same season at the same moment.
 */

import { clamp, smoothstep } from '../math/vec3';
import { hashSeed } from '../rng';
import { DAY_LENGTH_MS, dayProgress } from './day-night';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASONS)[number];

/** Six game days, so two real hours, to a season. */
export const DAYS_PER_SEASON = 6;
export const DAYS_PER_YEAR = SEASONS.length * DAYS_PER_SEASON;
export const SEASON_LENGTH_MS = DAYS_PER_SEASON * DAY_LENGTH_MS;
export const YEAR_LENGTH_MS = DAYS_PER_YEAR * DAY_LENGTH_MS;

/**
 * How much of the end of a season is spent easing into the next one, as a
 * share of the season. A quarter is a day and a half, so the forest changes
 * colour over half an hour rather than in a jump at midnight.
 */
export const SEASON_BLEND_SHARE = 0.25;

export interface Calendar {
  readonly season: SeasonId;
  /** 0 for spring up to 3 for winter. */
  readonly seasonIndex: number;
  /** Which day of the season it is, from 1 to `DAYS_PER_SEASON`. */
  readonly dayOfSeason: number;
  /** Which day of the year it is, from 0 to `DAYS_PER_YEAR - 1`. */
  readonly dayOfYear: number;
  /** How many times round the year this world has been, starting at 1. */
  readonly year: number;
  /** How far through the season it is, from 0 to just under 1. */
  readonly seasonProgress: number;
}

/** What the forest looks like right now: one season, or an even mix of two. */
export interface SeasonMix {
  readonly from: SeasonId;
  readonly to: SeasonId;
  /** 0 is wholly `from`, 1 is wholly `to`. */
  readonly amount: number;
}

/** The day of the year a world's calendar begins on, from its seed. */
export function worldStartDay(seed: number): number {
  return hashSeed('calendar-start', seed) % DAYS_PER_YEAR;
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** Where in the year this world is at this time. Days turn over at midnight. */
export function calendarAt(seed: number, nowMs: number): Calendar {
  const daysElapsed = Math.floor(nowMs / DAY_LENGTH_MS) + worldStartDay(seed);
  const dayOfYear = modulo(daysElapsed, DAYS_PER_YEAR);
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const dayIndex = dayOfYear % DAYS_PER_SEASON;
  return {
    season: SEASONS[seasonIndex]!,
    seasonIndex,
    dayOfSeason: dayIndex + 1,
    dayOfYear,
    year: Math.floor(daysElapsed / DAYS_PER_YEAR) + 1,
    seasonProgress: (dayIndex + dayProgress(nowMs)) / DAYS_PER_SEASON,
  };
}

/** The season that follows this one: winter leads back round to spring. */
export function nextSeason(season: SeasonId): SeasonId {
  return SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]!;
}

/**
 * What the forest should look like: the season itself for most of it, then a
 * smooth easing into the next one over the last stretch.
 */
export function seasonMix(calendar: Calendar): SeasonMix {
  const amount = smoothstep(calendar.seasonProgress, 1 - SEASON_BLEND_SHARE, 1);
  return { from: calendar.season, to: nextSeason(calendar.season), amount };
}

/** Reads a season's name, in any case, or says there is no such season. */
export function parseSeason(text: string | null | undefined): SeasonId | undefined {
  const wanted = text?.trim().toLowerCase();
  return SEASONS.find((season) => season === wanted);
}

/**
 * How far to push the clock so this world's calendar reads as the given day of
 * the given season. A whole number of days, so the time of day is untouched:
 * this is for looking at a season while testing, not for skipping a night.
 */
export function clockShiftForSeason(
  seed: number,
  nowMs: number,
  season: SeasonId,
  dayOfSeason = 1,
): number {
  const today = calendarAt(seed, nowMs).dayOfYear;
  const wanted =
    SEASONS.indexOf(season) * DAYS_PER_SEASON + clamp(dayOfSeason, 1, DAYS_PER_SEASON) - 1;
  return modulo(wanted - today, DAYS_PER_YEAR) * DAY_LENGTH_MS;
}

/**
 * Whether the lake is frozen over: all of winter, from its first morning to
 * the first morning of spring (decision 0095). The server works this out and
 * tells every browser, so it never depends on anybody's own clock.
 */
export function lakeIsFrozen(calendar: Calendar): boolean {
  return calendar.season === 'winter';
}
