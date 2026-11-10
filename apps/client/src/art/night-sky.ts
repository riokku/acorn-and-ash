/**
 * The night sky (decision 0290): stars that come out as the light goes, a
 * band of the Milky Way across them, and a moon that rises at dusk and sets
 * at dawn.
 *
 * Scenery only, like the far skyline it hangs behind. The stars come from the
 * same seed as that skyline, so every player looks up at the same sky.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 * North is -z, east is +x and up is +y, as everywhere else.
 */

import { createRng } from '@acorn/shared';

export interface Star {
  /** Where it is in the sky, as a direction of length 1, before the sky turns. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** How wide it is drawn, from 0 (the smallest) to 1 (the largest). */
  readonly size: number;
  /** How bright it is, from 0 to 1. Most stars are faint. */
  readonly brightness: number;
  /** -1 is a cool blue star, 0 is white and 1 is a warm amber one. */
  readonly warmth: number;
  /** Where in its twinkle it starts, 0 to 1. */
  readonly twinkle: number;
}

/** Stars scattered evenly over the whole sky. */
export const FIELD_STARS = 900;
/** Fainter stars crowded along the Milky Way. */
export const MILKY_WAY_STARS = 1500;
/** How far either side of its middle the Milky Way spreads, in radians (one standard deviation). */
const MILKY_WAY_SPREAD = 0.13;

/**
 * The direction the Milky Way's band is square to. Tilted well off the pole
 * the sky turns about, so the band swings across the sky through the night.
 */
export const MILKY_WAY_POLE = normalised(0.62, 0.38, 0.69);

/**
 * The point the sky turns about: due north, 47 degrees up, as it stands over
 * the forests of the Pacific Northwest.
 */
const POLE_HEIGHT = (47 * Math.PI) / 180;
export const SKY_POLE = { x: 0, y: Math.sin(POLE_HEIGHT), z: -Math.cos(POLE_HEIGHT) } as const;

function normalised(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

function cross(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/**
 * Every star in the sky for this world. The same seed always gives the same
 * stars in the same order: the scattered ones first, then the Milky Way's.
 */
export function starField(seed: number): Star[] {
  const rng = createRng((seed ^ 0x57a25) >>> 0);
  const stars: Star[] = [];

  for (let i = 0; i < FIELD_STARS; i++) {
    // Even over a sphere: an even height and an even turn about it.
    const y = rng.nextFloat() * 2 - 1;
    const turn = rng.nextFloat() * Math.PI * 2;
    const flat = Math.sqrt(1 - y * y);
    // Cubed, so a handful are bright and most are faint.
    const brightness = 0.22 + 0.78 * Math.pow(rng.nextFloat(), 3);
    stars.push({
      x: Math.cos(turn) * flat,
      y,
      z: Math.sin(turn) * flat,
      size: brightness * brightness,
      brightness,
      warmth: (rng.nextFloat() * 2 - 1) * rng.nextFloat(),
      twinkle: rng.nextFloat(),
    });
  }

  // Two directions lying in the band, to walk round it by.
  const level = cross(MILKY_WAY_POLE, { x: 0, y: 1, z: 0 });
  const along = normalised(level.x, level.y, level.z);
  const across = cross(MILKY_WAY_POLE, along);
  for (let i = 0; i < MILKY_WAY_STARS; i++) {
    const turn = rng.nextFloat() * Math.PI * 2;
    // Two throws added together crowd the stars towards the middle of the band.
    const off = (rng.nextFloat() + rng.nextFloat() - 1) * MILKY_WAY_SPREAD * 2.4;
    const inBand = Math.cos(off);
    const outOfBand = Math.sin(off);
    const cos = Math.cos(turn) * inBand;
    const sin = Math.sin(turn) * inBand;
    stars.push({
      x: along.x * cos + across.x * sin + MILKY_WAY_POLE.x * outOfBand,
      y: along.y * cos + across.y * sin + MILKY_WAY_POLE.y * outOfBand,
      z: along.z * cos + across.z * sin + MILKY_WAY_POLE.z * outOfBand,
      size: 0,
      brightness: 0.16 + 0.26 * rng.nextFloat(),
      warmth: (rng.nextFloat() * 2 - 1) * 0.5,
      twinkle: rng.nextFloat(),
    });
  }
  return stars;
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * How far the sky has turned about its pole, in radians, at a point in the
 * day (0 and 1 are midnight, 0.5 is noon). One whole turn a day.
 */
export function skyTurn(dayProgress: number): number {
  return dayProgress * Math.PI * 2;
}

/**
 * How strongly the stars show for how light it is (0 is midnight, 1 is
 * noon): none by day, the first at dusk, all of them once it is dark.
 */
export function starlight(daylight: number): number {
  return 1 - smoothstep(0.08, 0.4, daylight);
}

/** How strongly the moon shows. It is out earlier than the stars, pale in the evening sky. */
export function moonGlow(daylight: number): number {
  return 1 - smoothstep(0.3, 0.62, daylight);
}

/** How high the moon stands at midnight, in radians above the southern horizon. */
const MOON_HEIGHT = (52 * Math.PI) / 180;

/**
 * Where the moon is in the sky at a point in the day, as a direction of
 * length 1. It rises in the east as night begins (0.75), stands highest in
 * the south at midnight and sets in the west as night ends (0.25). By day it
 * is below the horizon.
 */
export function moonDirection(dayProgress: number): { x: number; y: number; z: number } {
  const wrapped = dayProgress - Math.floor(dayProgress);
  // 0 at midnight, a quarter turn either side at dusk and dawn.
  const angle = (wrapped < 0.5 ? wrapped : wrapped - 1) * Math.PI * 2;
  const up = Math.cos(angle);
  return {
    x: -Math.sin(angle),
    y: up * Math.sin(MOON_HEIGHT),
    z: up * Math.cos(MOON_HEIGHT),
  };
}
