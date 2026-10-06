import {
  DEFAULT_WORLD_SEED,
  calendarAt,
  clockShiftForSeason,
  seasonMix,
  type SeasonId,
  type SeasonMix,
} from '@acorn/shared';

/**
 * The time of year to show behind the front page, sign-in, character screen and
 * loading screen (decision 0106).
 *
 * It is worked out from the world's own calendar (decision 0089), the same one
 * the game uses once you are in, so the picture is already in the season you are
 * about to walk into. No world has a seed of its own yet, so this uses the
 * default one; the page has no connection to ask before the player is inside.
 *
 * `forced` is for looking at a season while testing (`?season=winter`), the same
 * switch the game has: it shows the first day of that season.
 */
export function backdropSeasonMix(nowMs: number, forced?: SeasonId): SeasonMix {
  const shifted =
    forced === undefined ? nowMs : nowMs + clockShiftForSeason(DEFAULT_WORLD_SEED, nowMs, forced);
  return seasonMix(calendarAt(DEFAULT_WORLD_SEED, shifted));
}

/**
 * A short name for how the painting looks, so the grade is only worked out again
 * when it would actually look different: each tenth of the way into the next
 * season is its own look.
 */
export function mixKey(mix: SeasonMix): string {
  return `${mix.from}>${mix.to}@${Math.round(mix.amount * 10)}`;
}
