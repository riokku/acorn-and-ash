/**
 * Where mist gathers and when (decision 0287).
 *
 * Mist lies on the water (the lake, the river and the home pond) and pools in
 * the hollows of the forest floor. It is thickest at dawn, comes back a little
 * at dusk and overnight, and hangs about in drizzle and rain. By the middle of
 * a clear day it has burned off.
 *
 * The spots come from the world's seed and its ground, so everyone in a world
 * finds mist in the same places. Each player's game draws it; the server knows
 * nothing of it and it changes no rule.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import {
  MOUNTAINS,
  PLAYABLE_HALF_EXTENT,
  POND_LEVEL,
  STREAM,
  createRng,
  dayBrightness,
  hashSeed,
  highPlainsWeight,
  isOnWater,
  navigableWaterDepthAt,
  navigableWaterSurfaceAt,
  streamSurfaceAt,
  type SeasonId,
  type SeasonMix,
  type WaterCircle,
  type WeatherKind,
} from '@acorn/shared';

export interface MistSpot {
  readonly x: number;
  /** The water's surface, or the ground, that the mist lies on. */
  readonly y: number;
  readonly z: number;
  /** Mist on water shows first and lasts longest; hollows only fill when it is thick. */
  readonly onWater: boolean;
  /** How wide this bank of mist is, in metres. */
  readonly width: number;
  /** Somewhere in its slow drift, 0 to a full turn, so no two banks move together. */
  readonly phase: number;
}

/** Metres between the spots tried across the map. */
const SPACING = 10;
/** A hollow is ground at least this far below the ground around it. */
const HOLLOW_DEPTH = 1.5;
const HOLLOW_REACH = 26;
/** Mist does not lie on a slope steeper than this, in metres of rise over six metres. */
const HOLLOW_LEVEL = 1.4;
/** Metres between banks of mist along the river. */
const RIVER_SPACING = 9;

/** Every spot in a world where mist can lie. */
export function mistSpots(
  seed: number,
  heightAt: (x: number, z: number) => number,
  pond: readonly WaterCircle[],
): MistSpot[] {
  const rng = createRng(hashSeed('valley-mist', seed));
  const spots: MistSpot[] = [];
  const edge = PLAYABLE_HALF_EXTENT - 6;
  for (let gx = -edge; gx <= edge; gx += SPACING) {
    for (let gz = -edge; gz <= edge; gz += SPACING) {
      const x = gx + rng.nextRange(-4, 4);
      const z = gz + rng.nextRange(-4, 4);
      const width = rng.nextRange(13, 20);
      const phase = rng.nextRange(0, Math.PI * 2);
      if (isOnWater(pond, x, z)) {
        spots.push({ x, y: POND_LEVEL, z, onWater: true, width: width * 0.6, phase });
        continue;
      }
      if (navigableWaterDepthAt(x, z) > 0) {
        spots.push({ x, y: navigableWaterSurfaceAt(x, z), z, onWater: true, width, phase });
        continue;
      }
      // The dry plains and the bare heights stay clear.
      if (highPlainsWeight(x, z) > 0.3) continue;
      const ground = heightAt(x, z);
      if (ground > MOUNTAINS.treeLine) continue;
      if (
        Math.abs(heightAt(x + 3, z) - heightAt(x - 3, z)) > HOLLOW_LEVEL ||
        Math.abs(heightAt(x, z + 3) - heightAt(x, z - 3)) > HOLLOW_LEVEL
      )
        continue;
      let around = 0;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        around += heightAt(x + Math.cos(angle) * HOLLOW_REACH, z + Math.sin(angle) * HOLLOW_REACH);
      }
      if (around / 8 - ground >= HOLLOW_DEPTH)
        spots.push({ x, y: ground, z, onWater: false, width, phase });
    }
  }
  // The river is too narrow for the grid to find, so it gets a line of its own.
  const rowLength = STREAM.length / (STREAM.count - 1);
  const every = Math.max(1, Math.round(RIVER_SPACING / rowLength));
  for (let row = 0; row < STREAM.count; row += every) {
    const x = STREAM.points[row * 2]!;
    const z = STREAM.points[row * 2 + 1]!;
    if (Math.abs(x) > edge || Math.abs(z) > edge) continue;
    spots.push({
      x,
      y: streamSurfaceAt(STREAM, row * rowLength),
      z,
      onWater: true,
      width: rng.nextRange(9, 13),
      phase: rng.nextRange(0, Math.PI * 2),
    });
  }
  return spots;
}

/** How misty each season is, against 1 for the mistiest. */
const SEASON_MIST: Readonly<Record<SeasonId, number>> = {
  spring: 0.9,
  summer: 0.6,
  autumn: 1,
  winter: 0.8,
};

function bell(value: number, centre: number, width: number): number {
  const from = (value - centre) / width;
  return Math.exp(-from * from);
}

export interface MistWeather {
  /** Where the day is: 0 and 1 are midnight, 0.25 is sunrise, 0.5 is noon. */
  readonly dayProgress: number;
  readonly kind: WeatherKind;
  /** How hard it is raining, 0 to 1. */
  readonly precipitation: number;
  readonly season: SeasonMix;
}

/** How much mist there is over the whole world right now, 0 to 1. */
export function mistStrength(weather: MistWeather): number {
  // A blizzard is its own whiteout, and its wind leaves no mist lying.
  if (weather.kind === 'blizzard') return 0;
  const dawn = bell(weather.dayProgress, 0.27, 0.07);
  const dusk = bell(weather.dayProgress, 0.78, 0.05) * 0.5;
  const dark = 1 - dayBrightness(weather.dayProgress);
  const night = Math.min(1, Math.max(0, (dark - 0.55) / 0.35)) * 0.38;
  // Rain raises mist off the water; a storm's wind tears most of it away.
  const wet =
    weather.kind === 'storm' ? 0.3 : Math.min(0.6, Math.max(0, weather.precipitation) * 0.9);
  const season =
    SEASON_MIST[weather.season.from] * (1 - weather.season.amount) +
    SEASON_MIST[weather.season.to] * weather.season.amount;
  return Math.min(1, Math.max(dawn, dusk, night, wet) * season);
}

/** How thick the mist is at one spot, 0 to 1, when the world's mist is this strong. */
export function mistAt(strength: number, onWater: boolean): number {
  if (onWater) return Math.min(1, Math.max(0, strength));
  return Math.min(1, Math.max(0, (strength - 0.3) / 0.5));
}
