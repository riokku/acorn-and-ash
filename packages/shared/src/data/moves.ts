/**
 * How long each of a character's moves takes, in simulation ticks (twenty a
 * second), and where in it things happen.
 *
 * Content as data: tuning how quick a swing is, when it lands or how long a
 * dodge carries you is a change to this table and nothing else. The server
 * and the browser both time every move from here (see `sim/actions.ts`), and
 * the browser lines each animation up so its blow lands on `impact`.
 */

import {
  CHARGE_SECONDS,
  DODGE_COOLDOWN_TICKS,
  DODGE_INVULNERABLE_SECONDS,
  TICK_HZ,
} from '../constants';

/** One swing of the light combo, in ticks from the one it started on. */
export interface ComboSwing {
  /** When the blow lands. */
  readonly impact: number;
  /** From here a click already waiting goes straight on to the next swing. */
  readonly chain: number;
  /** Feet stay put until here. After it, walking off cuts the follow-through short. */
  readonly planted: number;
  /** When it is over. */
  readonly end: number;
}

/**
 * Three swings, each a click: a quick diagonal slice, a flat slice back the
 * other way, and a heavier overhead chop to finish. Clicking again at any
 * point during a swing queues the next one; it follows on once the swing
 * before it has landed. A held button carries on from one swing to the next
 * when each finishes, which is how holding it chops a tree down.
 */
export const LIGHT_COMBO: readonly [ComboSwing, ComboSwing, ComboSwing] = [
  { impact: 4, chain: 6, planted: 7, end: 10 },
  { impact: 4, chain: 6, planted: 7, end: 10 },
  { impact: 5, chain: 14, planted: 10, end: 14 },
];

/** How long a charge winds up before it goes off: see `CHARGE_SECONDS`. */
export const CHARGE_TICKS = Math.round(CHARGE_SECONDS * TICK_HZ);

/**
 * The charged strike itself, once the wind-up is done: a leap and a slam,
 * given long enough in the air to read as one.
 */
export const STRIKE = { impact: 6, planted: 12, end: 16 } as const;

/**
 * A dodge roll: carried `DODGE_DISTANCE` over `travel` ticks, then a moment
 * to find your feet. Untouchable for the first `invulnerable` of them.
 */
export const DODGE = {
  travel: 8,
  end: 10,
  invulnerable: Math.round(DODGE_INVULNERABLE_SECONDS * TICK_HZ),
  cooldown: DODGE_COOLDOWN_TICKS,
} as const;

/**
 * How quickly a raider draws back before a combo's first swing (see
 * `ActionKind.Windup`), as its `step`: steady, quick or heavy.
 */
export const WindupPace = { Steady: 0, Quick: 1, Heavy: 2 } as const;
export type WindupPace = (typeof WindupPace)[keyof typeof WindupPace];

/**
 * How long each `WindupPace` holds the weapon back before the swing goes,
 * in ticks. Never shorter than a player could see coming and roll away
 * from: the quickest still gives the swing as long again as it takes to
 * land, the rest well over half a second all told.
 */
export const WINDUP_TICKS: readonly [number, number, number] = [10, 7, 13];

/** Taking a hit: a flinch that stops whatever you were doing. A dodge gets you out of it. */
export const FLINCH = { planted: 4, end: 12 } as const;

/** Down on the ground after a knockout, before waking up at home. */
export const KNOCKED_OUT_TICKS = 40;

/** Getting back up: out of bed, off the ground, or out of the chair. */
export const RISE = {
  ground: 31,
  bed: 31,
  chair: 16,
} as const;

/**
 * Settling into the chair or the bed. Pressing interact or moving before
 * this still gets you up, but not on the very tick you sat down.
 */
export const SETTLE = { chair: 16, bed: 40, earliestUp: 4 } as const;
