import { DAY_LENGTH_MS, calendarAt, type SeasonId } from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import {
  FIELD_STARS,
  METEOR_MS,
  MOON_CYCLE_NIGHTS,
  auroraTonight,
  meteorAt,
  meteorShowerTonight,
  moonLit,
  moonPhase,
  nightNumber,
  tonight,
  MILKY_WAY_POLE,
  MILKY_WAY_STARS,
  moonDirection,
  moonGlow,
  skyTurn,
  starField,
  starlight,
} from '../src/art/night-sky';

describe('the stars', () => {
  it('are the same for everyone in a world, and different in another', () => {
    expect(starField(7)).toEqual(starField(7));
    expect(starField(7)[0]).not.toEqual(starField(8)[0]);
  });

  it('are all the same distance away, with every number in range', () => {
    const stars = starField(1234);
    expect(stars).toHaveLength(FIELD_STARS + MILKY_WAY_STARS);
    for (const star of stars) {
      expect(Math.hypot(star.x, star.y, star.z)).toBeCloseTo(1, 6);
      expect(star.brightness).toBeGreaterThan(0);
      expect(star.brightness).toBeLessThanOrEqual(1);
      expect(star.size).toBeGreaterThanOrEqual(0);
      expect(star.size).toBeLessThanOrEqual(1);
      expect(Math.abs(star.warmth)).toBeLessThanOrEqual(1);
    }
  });

  it('are mostly faint, with a few bright ones', () => {
    const scattered = starField(99).slice(0, FIELD_STARS);
    const bright = scattered.filter((star) => star.brightness > 0.7).length;
    expect(bright).toBeGreaterThan(5);
    expect(bright).toBeLessThan(FIELD_STARS / 4);
  });

  it('crowd along the Milky Way', () => {
    const band = starField(5).slice(FIELD_STARS);
    for (const star of band) {
      const off = star.x * MILKY_WAY_POLE.x + star.y * MILKY_WAY_POLE.y + star.z * MILKY_WAY_POLE.z;
      expect(Math.abs(Math.asin(off))).toBeLessThan(0.33);
    }
  });

  it('turn once a day', () => {
    expect(skyTurn(0)).toBe(0);
    expect(skyTurn(0.5)).toBeCloseTo(Math.PI);
    expect(skyTurn(1)).toBeCloseTo(Math.PI * 2);
  });

  it('come out as the light goes', () => {
    expect(starlight(1)).toBe(0);
    expect(starlight(0.5)).toBe(0);
    expect(starlight(0)).toBe(1);
    expect(starlight(0.2)).toBeGreaterThan(0);
    expect(starlight(0.2)).toBeLessThan(1);
  });
});

describe('the moon', () => {
  it('rises in the east at dusk, stands in the south at midnight and sets in the west at dawn', () => {
    const rising = moonDirection(0.75);
    expect(rising.x).toBeCloseTo(1);
    expect(rising.y).toBeCloseTo(0);
    const high = moonDirection(0);
    expect(high.x).toBeCloseTo(0);
    expect(high.y).toBeGreaterThan(0.7);
    expect(high.z).toBeGreaterThan(0);
    const setting = moonDirection(0.25);
    expect(setting.x).toBeCloseTo(-1);
    expect(setting.y).toBeCloseTo(0);
  });

  it('is below the horizon all day and above it all night', () => {
    for (const day of [0.3, 0.4, 0.5, 0.6, 0.7]) expect(moonDirection(day).y).toBeLessThan(0);
    for (const night of [0.8, 0.9, 0, 1, 0.1, 0.2])
      expect(moonDirection(night).y).toBeGreaterThan(0);
  });

  it('always points somewhere of length 1', () => {
    for (let i = 0; i <= 20; i++) {
      const at = moonDirection(i / 20);
      expect(Math.hypot(at.x, at.y, at.z)).toBeCloseTo(1, 6);
    }
  });

  it('shows before the stars do and is gone by full day', () => {
    expect(moonGlow(1)).toBe(0);
    expect(moonGlow(0)).toBe(1);
    expect(moonGlow(0.4)).toBeGreaterThan(starlight(0.4));
  });
});

describe('the moon’s phases', () => {
  const day = DAY_LENGTH_MS;

  it('hold for a whole night and step on at noon', () => {
    const dusk = 10.8 * day;
    const midnight = 11 * day;
    const dawn = 11.2 * day;
    expect(nightNumber(dusk)).toBe(nightNumber(dawn));
    expect(moonPhase(3, dusk)).toBe(moonPhase(3, midnight));
    expect(moonPhase(3, midnight)).toBe(moonPhase(3, dawn));
    expect(moonPhase(3, 11.6 * day)).not.toBe(moonPhase(3, midnight));
  });

  it('come round again after a season of nights', () => {
    const seen = new Set<number>();
    for (let night = 0; night < MOON_CYCLE_NIGHTS; night++) seen.add(moonPhase(3, night * day));
    expect(seen.size).toBe(MOON_CYCLE_NIGHTS);
    expect(seen.has(0)).toBe(true);
    expect(seen.has(0.5)).toBe(true);
    expect(moonPhase(3, MOON_CYCLE_NIGHTS * day)).toBe(moonPhase(3, 0));
  });

  it('light none of the face when new, half at the quarters and all of it when full', () => {
    expect(moonLit(0)).toBeCloseTo(0);
    expect(moonLit(0.25)).toBeCloseTo(0.5);
    expect(moonLit(0.5)).toBeCloseTo(1);
    expect(moonLit(0.75)).toBeCloseTo(0.5);
  });
});

describe('the northern lights', () => {
  /** Midnights of the nights that begin in a season, over many years. */
  function nights(seed: number, season: SeasonId): number[] {
    const found: number[] = [];
    for (let night = 1; night < 2400; night++) {
      const midnight = night * DAY_LENGTH_MS;
      if (calendarAt(seed, midnight - DAY_LENGTH_MS / 4).season === season) found.push(midnight);
    }
    return found;
  }

  it('never show in summer', () => {
    for (const midnight of nights(11, 'summer')) expect(auroraTonight(11, midnight)).toBe(0);
  });

  it('show on most winter nights and few spring ones', () => {
    const share = (season: SeasonId) => {
      const all = nights(11, season);
      return all.filter((midnight) => auroraTonight(11, midnight) > 0).length / all.length;
    };
    expect(share('winter')).toBeGreaterThan(0.55);
    expect(share('winter')).toBeLessThan(0.85);
    expect(share('spring')).toBeLessThan(0.3);
    expect(share('autumn')).toBeGreaterThan(share('spring'));
  });

  it('are the same from dusk to dawn', () => {
    for (let night = 1; night < 60; night++) {
      const midnight = night * DAY_LENGTH_MS;
      expect(auroraTonight(11, midnight - DAY_LENGTH_MS * 0.2)).toBe(
        auroraTonight(11, midnight + DAY_LENGTH_MS * 0.2),
      );
    }
  });
});

describe('shooting stars', () => {
  function count(seed: number, midnight: number): number {
    // Sampled more often than one lasts, counting each fresh one once.
    let seen = 0;
    let falling = false;
    for (let at = midnight; at < midnight + 240_000; at += METEOR_MS / 3) {
      const now = meteorAt(seed, at) !== null;
      if (now && !falling) seen++;
      falling = now;
    }
    return seen;
  }
  const ordinary = [...Array(200).keys()]
    .map((night) => (night + 1) * DAY_LENGTH_MS)
    .find((midnight) => !meteorShowerTonight(21, midnight))!;
  const shower = [...Array(200).keys()]
    .map((night) => (night + 1) * DAY_LENGTH_MS)
    .find((midnight) => meteorShowerTonight(21, midnight))!;

  it('are the same for everyone at the same moment', () => {
    for (let at = ordinary; at < ordinary + 60_000; at += 250) {
      expect(meteorAt(21, at)).toEqual(meteorAt(21, at));
    }
  });

  it('fall a few times in four minutes on an ordinary night, and far more in a shower', () => {
    const few = count(21, ordinary);
    const many = count(21, shower);
    expect(few).toBeGreaterThan(1);
    expect(few).toBeLessThan(14);
    expect(many).toBeGreaterThan(few * 3);
  });

  it('start up in the sky, fall downwards and stay above the ground', () => {
    let checked = 0;
    for (let at = shower; at < shower + 120_000; at += 200) {
      const meteor = meteorAt(21, at);
      if (meteor === null) continue;
      checked++;
      expect(meteor.progress).toBeGreaterThanOrEqual(0);
      expect(meteor.progress).toBeLessThanOrEqual(1);
      expect(meteor.to.y).toBeLessThan(meteor.from.y);
      expect(meteor.to.y).toBeGreaterThan(0.15);
      expect(Math.hypot(meteor.from.x, meteor.from.y, meteor.from.z)).toBeCloseTo(1, 6);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('come in showers about one night in six', () => {
    let showers = 0;
    for (let night = 0; night < 600; night++)
      if (meteorShowerTonight(21, night * DAY_LENGTH_MS)) showers++;
    expect(showers).toBeGreaterThan(60);
    expect(showers).toBeLessThan(140);
  });
});

describe('tonight', () => {
  it('gathers the moon, the lights and any shooting star', () => {
    const at = 37.02 * DAY_LENGTH_MS;
    expect(tonight(5, at)).toEqual({
      moonPhase: moonPhase(5, at),
      aurora: auroraTonight(5, at),
      meteor: meteorAt(5, at),
    });
  });
});
