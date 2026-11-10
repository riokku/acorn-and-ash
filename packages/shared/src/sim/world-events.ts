/**
 * World events (decision 0294): things that happen in the world for everyone
 * at once, by the calendar.
 *
 * An event belongs to a season and comes once in it, so it is an occasion. The
 * server and every browser work out what is on from the same calendar, so no
 * message is needed to start or end one, and everyone sees it begin together.
 *
 * The first is the salmon run: for the first two days of autumn, salmon come
 * up the Alderwash from Mirrormere, and the lake fishes better than at any
 * other time of year.
 */

import type { FishRow } from '../data/fish';
import { DAY_LENGTH_MS } from './day-night';
import { DAYS_PER_SEASON, type Calendar, type SeasonId } from './seasons';

export type WorldEventId = 'salmonRun';

export interface WorldEventKind {
  readonly id: WorldEventId;
  readonly name: string;
  /** Said under its name as it begins. */
  readonly opening: string;
  /** Said when it is over. */
  readonly closing: string;
  readonly season: SeasonId;
  /** The day of its season it begins on, from 1. */
  readonly firstDay: number;
  /** How many whole days it lasts. */
  readonly days: number;
}

export const WORLD_EVENTS = {
  salmonRun: {
    id: 'salmonRun',
    name: 'The Salmon Run',
    opening: 'Salmon are running up the Alderwash',
    closing: 'The salmon have gone upstream',
    season: 'autumn',
    firstDay: 1,
    days: 2,
  },
} as const satisfies Record<WorldEventId, WorldEventKind>;

/** An event that is on, and how much of it is left. */
export interface WorldEventNow {
  readonly event: WorldEventKind;
  /** How long until it ends, in milliseconds of the world's clock. */
  readonly endsInMs: number;
}

/** The event on at this point in the calendar, if any. */
export function worldEventOn(calendar: Calendar): WorldEventNow | null {
  for (const event of Object.values(WORLD_EVENTS)) {
    if (calendar.season !== event.season) continue;
    // How many days into the season it is, counting the part of today that has gone.
    const daysIn = calendar.seasonProgress * DAYS_PER_SEASON;
    const begins = event.firstDay - 1;
    const ends = begins + event.days;
    if (daysIn < begins || daysIn >= ends) continue;
    return { event, endsInMs: (ends - daysIn) * DAY_LENGTH_MS };
  }
  return null;
}

/**
 * What a line cast into the lake brings up during the salmon run: the same
 * fish as ever, with the good ones far likelier (trout from three in ten to
 * nearly half, a golden carp from one in ten to one in four).
 */
export const SALMON_RUN_FISH: readonly FishRow[] = [
  { item: 'perch', weight: 28 },
  { item: 'trout', weight: 47 },
  { item: 'goldenCarp', weight: 25 },
];

/** Fish bite sooner in the run: a cast waits this share of its usual time. */
export const SALMON_RUN_BITE_DELAY = 0.7;

/** Whether a cast made now fishes the salmon run. Only the lake does; the home pond is as ever. */
export function fishesTheSalmonRun(calendar: Calendar, onTheLake: boolean): boolean {
  return onTheLake && worldEventOn(calendar)?.event.id === 'salmonRun';
}

/** "Ends in 34 minutes": how long an event has to go, in minutes of real time. */
export function worldEventTimeLeft(endsInMs: number): string {
  const minutes = Math.max(1, Math.ceil(endsInMs / 60_000));
  return minutes === 1 ? 'Ends in a minute' : `Ends in ${minutes} minutes`;
}
