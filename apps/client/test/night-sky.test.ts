import { describe, expect, it } from 'vitest';

import {
  FIELD_STARS,
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
