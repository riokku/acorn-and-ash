/**
 * How the forest looks in each season (see decision 0089).
 *
 * Every season is a handful of colours that are multiplied onto what is
 * already painted, plus how much snow there is, so one table drives the sky,
 * the sunlight, the ground, the grass and the trees alike. Between two seasons
 * the game blends the tables, which is what makes the forest change colour
 * slowly instead of jumping at midnight.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import type { SeasonId, SeasonMix } from '@acorn/shared';

/** Red, green and blue, each around 1 (1 leaves a colour as painted). */
export type Rgb = readonly [number, number, number];

export interface SeasonLook {
  /** Multiplies the sky, and the fog that fades into it. */
  readonly sky: Rgb;
  /** Multiplies the colour of the sun and of the light from the sky. */
  readonly light: Rgb;
  /** Multiplies how bright the sun is. */
  readonly sunStrength: number;
  /** Multiplies the painted ground. */
  readonly ground: Rgb;
  /** Multiplies the blades of grass. */
  readonly blades: Rgb;
  /** Multiplies the needles and leaves of the trees. */
  readonly foliage: Rgb;
  /** How much of the ground, grass and trees is under snow: 0 none, 1 deep. */
  readonly snow: number;
}

export const SEASON_LOOKS: Readonly<Record<SeasonId, SeasonLook>> = {
  // Fresh and bright: the greens turn up a notch and the light is clear.
  spring: {
    sky: [0.98, 1.02, 1.04],
    light: [1, 1.02, 1],
    sunStrength: 1,
    ground: [0.97, 1.1, 0.96],
    blades: [0.95, 1.18, 0.88],
    foliage: [0.96, 1.08, 0.94],
    snow: 0,
  },
  // Deep, lush and golden: the longest, warmest light of the year.
  summer: {
    sky: [1.02, 1.02, 0.97],
    light: [1.05, 1, 0.9],
    sunStrength: 1.08,
    ground: [0.97, 1.03, 0.86],
    blades: [1, 1.05, 0.82],
    foliage: [0.92, 1.02, 0.86],
    snow: 0,
  },
  // Hazy amber: the grass goes gold and russet, the trees turn a touch warm.
  autumn: {
    sky: [1.06, 0.95, 0.88],
    light: [1.07, 0.92, 0.78],
    sunStrength: 0.9,
    ground: [1.3, 0.97, 0.58],
    blades: [1.85, 1.08, 0.55],
    foliage: [1.08, 0.97, 0.76],
    snow: 0,
  },
  // Cold and quiet: a pale blue-grey sky, low weak sun, snow on everything.
  winter: {
    sky: [0.86, 0.95, 1.12],
    light: [0.88, 0.97, 1.12],
    sunStrength: 0.78,
    ground: [0.9, 0.96, 1.04],
    blades: [1.05, 1.1, 1.15],
    foliage: [0.84, 0.95, 0.96],
    snow: 1,
  },
};

function blend(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

/** The look for a season, or for any point along the way into the next one. */
export function lookFor(mix: SeasonMix): SeasonLook {
  const from = SEASON_LOOKS[mix.from];
  const to = SEASON_LOOKS[mix.to];
  const amount = mix.amount;
  return {
    sky: blend(from.sky, to.sky, amount),
    light: blend(from.light, to.light, amount),
    sunStrength: from.sunStrength + (to.sunStrength - from.sunStrength) * amount,
    ground: blend(from.ground, to.ground, amount),
    blades: blend(from.blades, to.blades, amount),
    foliage: blend(from.foliage, to.foliage, amount),
    snow: from.snow + (to.snow - from.snow) * amount,
  };
}
