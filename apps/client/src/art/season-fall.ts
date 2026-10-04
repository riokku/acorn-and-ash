/**
 * What drifts through the air in each season (see decision 0089): petals in
 * spring, golden pollen in summer, leaves in autumn and snowflakes in winter.
 *
 * Each kind is how full its pool is, from 0 (none) to 1 (all of it). A kind
 * fades in over the last day and a half of the season before its own and fades
 * out over the last day and a half of its own, the same easing the colours use,
 * so the first leaves fall while it is still summer and the last ones go as the
 * snow arrives.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import type { SeasonId, SeasonMix } from '@acorn/shared';

export type FallKind = 'petals' | 'pollen' | 'leaves' | 'snow';

export type FallAmounts = Readonly<Record<FallKind, number>>;

/** The one thing that drifts in each season. */
export const FALL_OF_SEASON: Readonly<Record<SeasonId, FallKind>> = {
  spring: 'petals',
  summer: 'pollen',
  autumn: 'leaves',
  winter: 'snow',
};

/** How much of each kind is in the air for this season, or this point on the way into the next. */
export function fallFor(mix: SeasonMix): FallAmounts {
  const amounts: Record<FallKind, number> = { petals: 0, pollen: 0, leaves: 0, snow: 0 };
  amounts[FALL_OF_SEASON[mix.from]] += 1 - mix.amount;
  amounts[FALL_OF_SEASON[mix.to]] += mix.amount;
  return amounts;
}

/**
 * Snow takes over from rain as winter comes: how much of the rain still shows,
 * from 1 (all of it) down to 0 (none) once the snow is half in.
 */
export function rainShareFor(mix: SeasonMix): number {
  return 1 - Math.min(1, fallFor(mix).snow * 2);
}
