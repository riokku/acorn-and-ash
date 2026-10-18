/** Seasonal pollen and snow; the old square petals and leaves are disabled. */

import type { SeasonId, SeasonMix } from '@acorn/shared';

export type FallKind = 'petals' | 'pollen' | 'leaves' | 'snow';

export type FallAmounts = Readonly<Record<FallKind, number>>;

/** Spring and autumn have no decorative falling particles. */
export const FALL_OF_SEASON: Readonly<Record<SeasonId, FallKind | null>> = {
  spring: null,
  summer: 'pollen',
  autumn: null,
  winter: 'snow',
};

/** How much of each kind is in the air for this season, or this point on the way into the next. */
export function fallFor(mix: SeasonMix): FallAmounts {
  const amounts: Record<FallKind, number> = { petals: 0, pollen: 0, leaves: 0, snow: 0 };
  const from = FALL_OF_SEASON[mix.from];
  const to = FALL_OF_SEASON[mix.to];
  if (from) amounts[from] += 1 - mix.amount;
  if (to) amounts[to] += mix.amount;
  return amounts;
}

/**
 * Snow takes over from rain as winter comes: how much of the rain still shows,
 * from 1 (all of it) down to 0 (none) once the snow is half in.
 */
export function rainShareFor(mix: SeasonMix): number {
  return 1 - Math.min(1, fallFor(mix).snow * 2);
}
