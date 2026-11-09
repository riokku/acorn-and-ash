import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORLD_SEED,
  LAKE,
  MOUNTAINS,
  PLAYABLE_HALF_EXTENT,
  buildTestClearing,
  createWildernessTerrain,
  highPlainsWeight,
  isOnLake,
  type SeasonId,
  type WeatherKind,
} from '@acorn/shared';

import { mistAt, mistSpots, mistStrength } from '../src/art/valley-mist';

function weatherAt(
  dayProgress: number,
  kind: WeatherKind = 'clear',
  precipitation = 0,
  season: SeasonId = 'autumn',
) {
  return { dayProgress, kind, precipitation, season: { from: season, to: season, amount: 0 } };
}

describe('where mist lies', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
  const spots = mistSpots(DEFAULT_WORLD_SEED, terrain.heightAt, clearing.water);

  it('is the same for everyone in a world', () => {
    expect(mistSpots(DEFAULT_WORLD_SEED, terrain.heightAt, clearing.water)).toEqual(spots);
  });

  it('covers the lake, the home pond and the hollows, inside the world', () => {
    expect(spots.filter((spot) => isOnLake(LAKE, spot.x, spot.z)).length).toBeGreaterThan(20);
    expect(spots.some((spot) => spot.onWater && Math.hypot(spot.x, spot.z) < 30)).toBe(true);
    expect(spots.filter((spot) => !spot.onWater).length).toBeGreaterThan(10);
    for (const spot of spots) {
      expect(Math.abs(spot.x)).toBeLessThan(PLAYABLE_HALF_EXTENT);
      expect(Math.abs(spot.z)).toBeLessThan(PLAYABLE_HALF_EXTENT);
    }
  });

  it('keeps hollows off the dry plains and the bare heights', () => {
    for (const spot of spots) {
      if (spot.onWater) continue;
      expect(highPlainsWeight(spot.x, spot.z)).toBeLessThanOrEqual(0.3);
      expect(spot.y).toBeLessThanOrEqual(MOUNTAINS.treeLine);
    }
  });

  it('stays few enough to check every frame', () => {
    expect(spots.length).toBeLessThan(1500);
  });
});

describe('when there is mist', () => {
  it('is thickest at dawn and gone by the middle of a clear day', () => {
    expect(mistStrength(weatherAt(0.27))).toBeGreaterThan(0.9);
    expect(mistStrength(weatherAt(0.5))).toBeLessThan(0.02);
    // The art gallery's usual hour stays clear, so its other pictures do not change.
    expect(mistStrength(weatherAt(0.42))).toBeLessThan(0.02);
  });

  it('comes back a little at dusk and overnight', () => {
    const dusk = mistStrength(weatherAt(0.78));
    const midnight = mistStrength(weatherAt(0));
    expect(dusk).toBeGreaterThan(0.3);
    expect(dusk).toBeLessThan(mistStrength(weatherAt(0.27)));
    expect(midnight).toBeGreaterThan(0.2);
  });

  it('hangs about in rain, thins in a storm and is gone in a blizzard', () => {
    const rain = mistStrength(weatherAt(0.5, 'rain', 1));
    expect(rain).toBeGreaterThan(0.4);
    expect(mistStrength(weatherAt(0.5, 'storm', 1))).toBeLessThan(rain);
    expect(mistStrength(weatherAt(0.27, 'blizzard', 1, 'winter'))).toBe(0);
  });

  it('is mistiest in autumn and least in summer', () => {
    const at = (season: SeasonId) => mistStrength(weatherAt(0.3, 'clear', 0, season));
    expect(at('autumn')).toBeGreaterThan(at('spring'));
    expect(at('spring')).toBeGreaterThan(at('summer'));
  });

  it('lies on water first, and fills the hollows only once it is thick', () => {
    expect(mistAt(0.25, true)).toBeGreaterThan(0);
    expect(mistAt(0.25, false)).toBe(0);
    expect(mistAt(1, false)).toBe(1);
    expect(mistAt(0, true)).toBe(0);
  });
});
