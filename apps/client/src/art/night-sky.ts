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

import { DAY_LENGTH_MS, calendarAt, createRng, hashSeed, type SeasonId } from '@acorn/shared';

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

/**
 * Which night this is, counted from the world's first. A night runs from one
 * noon to the next, so the whole of it, either side of midnight, is one night.
 */
export function nightNumber(nowMs: number): number {
  return Math.floor(nowMs / DAY_LENGTH_MS + 0.5);
}

/** How many nights the moon takes to go from full round to full again: one season. */
export const MOON_CYCLE_NIGHTS = 6;

/**
 * Where the moon is in its month on this night: 0 is a new moon, 0.25 a
 * waxing half, 0.5 a full moon and 0.75 a waning half. It holds still for a
 * whole night and steps on at noon, when nobody can see it.
 */
export function moonPhase(seed: number, nowMs: number): number {
  const start = hashSeed('moon', seed) % MOON_CYCLE_NIGHTS;
  const night =
    (((nightNumber(nowMs) + start) % MOON_CYCLE_NIGHTS) + MOON_CYCLE_NIGHTS) % MOON_CYCLE_NIGHTS;
  return night / MOON_CYCLE_NIGHTS;
}

/** How much of the moon's face is lit at a phase, 0 (new) to 1 (full). */
export function moonLit(phase: number): number {
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

/** A throw of the dice between 0 and 1 that is the same for everyone. */
function chance(...parts: readonly (string | number)[]): number {
  return hashSeed(...parts) / 0x1_0000_0000;
}

/** How likely the northern lights are on a night that begins in each season. */
const AURORA_CHANCE: Readonly<Record<SeasonId, number>> = {
  spring: 0.15,
  summer: 0,
  autumn: 0.3,
  winter: 0.7,
};

/**
 * How strongly the northern lights show tonight, from 0 (none) to 1. Mostly a
 * winter sight, sometimes autumn, rarely spring and never summer. Decided once
 * for the whole night, from the season the night began in.
 */
export function auroraTonight(seed: number, nowMs: number): number {
  const night = nightNumber(nowMs);
  const dusk = (night - 0.25) * DAY_LENGTH_MS;
  const likely = AURORA_CHANCE[calendarAt(seed, dusk).season];
  if (chance('aurora', seed, night) >= likely) return 0;
  return 0.55 + 0.45 * chance('aurora-strength', seed, night);
}

/** One night in this many is a meteor shower. */
const SHOWER_EVERY = 6;

/** Whether tonight is a meteor shower, when shooting stars come thick and fast. */
export function meteorShowerTonight(seed: number, nowMs: number): boolean {
  return hashSeed('meteor-shower', seed, nightNumber(nowMs)) % SHOWER_EVERY === 0;
}

/** How long a shooting star takes to cross its path, in milliseconds. */
export const METEOR_MS = 900;
/** The sky is given one chance of a shooting star in every stretch this long. */
const METEOR_SLOT_MS = 12_000;
const SHOWER_SLOT_MS = 2_500;
const METEOR_CHANCE = 0.3;
const SHOWER_CHANCE = 0.75;

export interface Meteor {
  /** Where it starts and ends, as directions of length 1. */
  readonly from: { x: number; y: number; z: number };
  readonly to: { x: number; y: number; z: number };
  /** How far along it is, 0 to 1. */
  readonly progress: number;
  /** How bright this one is, 0 to 1. */
  readonly brightness: number;
}

/**
 * The shooting star crossing the sky at this moment, if there is one. Worked
 * out from the clock alone, so everyone looking up sees the same one. On an
 * ordinary night there is one every half minute or so; in a shower, one every
 * few seconds.
 */
export function meteorAt(seed: number, nowMs: number): Meteor | null {
  const shower = meteorShowerTonight(seed, nowMs);
  const slotMs = shower ? SHOWER_SLOT_MS : METEOR_SLOT_MS;
  const slot = Math.floor(nowMs / slotMs);
  if (chance('meteor', seed, slot) >= (shower ? SHOWER_CHANCE : METEOR_CHANCE)) return null;
  const rng = createRng(hashSeed('meteor-path', seed, slot));
  const begins = slot * slotMs + rng.nextFloat() * (slotMs - METEOR_MS);
  const progress = (nowMs - begins) / METEOR_MS;
  if (progress < 0 || progress > 1) return null;

  // Start somewhere well up the sky and fall away at a slant.
  const turn = rng.nextFloat() * Math.PI * 2;
  const height = (30 + rng.nextFloat() * 45) * (Math.PI / 180);
  const swing = (rng.nextFloat() * 2 - 1) * 0.5;
  const fall = (9 + rng.nextFloat() * 9) * (Math.PI / 180);
  const endTurn = turn + swing * 0.5;
  const endHeight = height - fall;
  return {
    from: skyPoint(turn, height),
    to: skyPoint(endTurn, endHeight),
    progress,
    brightness: 0.6 + 0.4 * rng.nextFloat(),
  };
}

function skyPoint(turn: number, height: number): { x: number; y: number; z: number } {
  const flat = Math.cos(height);
  return { x: Math.cos(turn) * flat, y: Math.sin(height), z: Math.sin(turn) * flat };
}

/** Everything about tonight that the sky needs beyond the hour. */
export interface Tonight {
  /** 0 is a new moon, 0.5 is full (see `moonPhase`). */
  readonly moonPhase: number;
  /** How strongly the northern lights show, 0 to 1. */
  readonly aurora: number;
  /** The shooting star in the sky right now, if any. */
  readonly meteor: Meteor | null;
}

/** A plain night: a full moon and nothing else going on. */
export const PLAIN_NIGHT: Tonight = { moonPhase: 0.5, aurora: 0, meteor: null };

export function tonight(seed: number, nowMs: number): Tonight {
  return {
    moonPhase: moonPhase(seed, nowMs),
    aurora: auroraTonight(seed, nowMs),
    meteor: meteorAt(seed, nowMs),
  };
}
