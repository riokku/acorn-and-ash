/**
 * The geometry of the season ring around the minimap (decision 0110): one arc
 * for each day of the year, running clockwise from the top, so the year's
 * progress reads like a clock hand going round the map. Spring takes the first
 * quarter, then summer, autumn and winter, six days to each.
 *
 * Plain numbers in, plain numbers out, so the drawing code has nothing to get
 * wrong and the shape can be tested without a browser.
 */

import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, type SeasonId } from '@acorn/shared';

/** Which way each piece of the ring is lit. */
export type RingDayState = 'past' | 'today' | 'future';

export interface RingSegment {
  /** Which day of the year this piece stands for, from 1 to `DAYS_PER_YEAR`. */
  readonly day: number;
  readonly season: SeasonId;
  /** Which day of its season, from 1 to `DAYS_PER_SEASON`. */
  readonly dayOfSeason: number;
  readonly state: RingDayState;
  /** An SVG path for the arc, ready to stroke. */
  readonly path: string;
}

/** The empty slice between two days of the same season, in degrees. */
export const RING_DAY_GAP_DEGREES = 2;
/** A wider one where one season ends and the next begins, so the four read as four. */
export const RING_SEASON_GAP_DEGREES = 8;

/** How far round the ring one season goes, in degrees. */
const SEASON_DEGREES = 360 / SEASONS.length;
const DAY_DEGREES = 360 / DAYS_PER_YEAR;

/**
 * A point on a circle, with 0 degrees straight up and angles growing clockwise.
 * SVG's y axis points down, so up is a negative y.
 */
export function ringPoint(
  radius: number,
  degrees: number,
  centre = 0,
): { readonly x: number; readonly y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: centre + radius * Math.sin(radians), y: centre - radius * Math.cos(radians) };
}

/** An arc between two angles, drawn clockwise. Narrower than half a circle, so one arc command is enough. */
export function ringArc(
  radius: number,
  fromDegrees: number,
  toDegrees: number,
  centre = 0,
): string {
  const start = ringPoint(radius, fromDegrees, centre);
  const end = ringPoint(radius, toDegrees, centre);
  const largeArc = toDegrees - fromDegrees > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

/** The angle at the middle of a season's quarter of the ring, where its badge goes. */
export function seasonMiddleDegrees(seasonIndex: number): number {
  return (seasonIndex + 0.5) * SEASON_DEGREES;
}

/**
 * The pieces of the ring for a year: days gone are `past`, the day it is now
 * is `today` and the rest are `future`. `todayOfYear` counts from 0, like the
 * calendar's `dayOfYear`. The year starts at the top, just after the gap, and
 * the last piece ends just before it.
 */
export function ringSegments(
  todayOfYear: number,
  radius: number,
  centre = 0,
): readonly RingSegment[] {
  return Array.from({ length: DAYS_PER_YEAR }, (_, index) => {
    const seasonIndex = Math.floor(index / DAYS_PER_SEASON);
    const dayOfSeason = (index % DAYS_PER_SEASON) + 1;
    // Each day is trimmed by half a day gap each side. The first and last day of a
    // season are trimmed a little more, up to half a season gap, on the side that
    // faces the neighbouring season.
    const startTrim = (dayOfSeason === 1 ? RING_SEASON_GAP_DEGREES : RING_DAY_GAP_DEGREES) / 2;
    const endTrim =
      (dayOfSeason === DAYS_PER_SEASON ? RING_SEASON_GAP_DEGREES : RING_DAY_GAP_DEGREES) / 2;
    const from = index * DAY_DEGREES + startTrim;
    const to = (index + 1) * DAY_DEGREES - endTrim;
    const state: RingDayState =
      index < todayOfYear ? 'past' : index === todayOfYear ? 'today' : 'future';
    return {
      day: index + 1,
      season: SEASONS[seasonIndex] as SeasonId,
      dayOfSeason,
      state,
      path: ringArc(radius, from, to, centre),
    };
  });
}

/** Keeps the paths short and stable, so a test can read them. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
