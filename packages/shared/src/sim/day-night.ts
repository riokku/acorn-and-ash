/**
 * Time of day: a 20-minute cycle, always running.
 *
 * There is nothing here for the server to own beyond the clock it already
 * keeps. `nowMs` is the same wall-clock time `WorldSimulation.step` already
 * takes, so time of day is a pure function of it - no new saved state, no new
 * wire message. The client works it out the same way, from the serverTimeMs
 * it already gets on welcome and every snapshot, which is what keeps
 * everyone in a world seeing the same day at the same moment. This also
 * means night never skips: nobody can fast-forward a clock nothing owns.
 */

import { DAY_LENGTH_SECONDS } from '../constants';

export const DAY_LENGTH_MS = DAY_LENGTH_SECONDS * 1000;

/** Where the cycle is right now: 0 and 1 are midnight, 0.5 is noon. */
export function dayProgress(nowMs: number): number {
  return (((nowMs % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS) / DAY_LENGTH_MS;
}

/**
 * How light it is, from 0 (the dark of night) to 1 (full noon).
 *
 * A smooth curve rather than a switch, so dawn and dusk are gradients a
 * player can watch happen, not a sky that snaps between two states.
 */
export function dayBrightness(progress: number): number {
  return (1 - Math.cos(progress * 2 * Math.PI)) / 2;
}

/** Night is an even 10 minutes out of the 20, centred on midnight. */
export const NIGHT_START = 0.75;
export const NIGHT_END = 0.25;

/** Whether it counts as night right now, for the HUD and for anything later that only threatens after dark. */
export function isNight(progress: number): boolean {
  return progress >= NIGHT_START || progress < NIGHT_END;
}
