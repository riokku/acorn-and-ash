import { describe, expect, it } from 'vitest';

import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS } from '@acorn/shared';

import {
  RING_DAY_GAP_DEGREES,
  RING_SEASON_GAP_DEGREES,
  ringArc,
  ringPoint,
  ringSegments,
  seasonMiddleDegrees,
} from '../src/hud/season-ring';

describe('points on the season ring', () => {
  it('starts straight up and goes clockwise', () => {
    const top = ringPoint(100, 0);
    expect(top.x).toBeCloseTo(0);
    expect(top.y).toBeCloseTo(-100);
    // A quarter of the way round clockwise is the right-hand side, not the left.
    const right = ringPoint(100, 90);
    expect(right.x).toBeCloseTo(100);
    expect(right.y).toBeCloseTo(0);
    const bottom = ringPoint(100, 180);
    expect(bottom.x).toBeCloseTo(0);
    expect(bottom.y).toBeCloseTo(100);
    const left = ringPoint(100, 270);
    expect(left.x).toBeCloseTo(-100);
  });

  it('can be centred somewhere else', () => {
    const top = ringPoint(10, 0, 50);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(40);
  });

  it('draws an arc clockwise, and short of half a circle in one piece', () => {
    expect(ringArc(100, 0, 90)).toBe('M 0 -100 A 100 100 0 0 1 100 0');
    expect(ringArc(100, 0, 270)).toContain('A 100 100 0 1 1');
  });
});

describe('where each season sits on the ring', () => {
  it('gives spring the top right, then summer, autumn and winter clockwise', () => {
    // The middle of each quarter: 45, 135, 225 and 315 degrees.
    expect(SEASONS.map((_, index) => seasonMiddleDegrees(index))).toEqual([45, 135, 225, 315]);
    const spring = ringPoint(100, seasonMiddleDegrees(0));
    expect(spring.x).toBeGreaterThan(0);
    expect(spring.y).toBeLessThan(0);
    const summer = ringPoint(100, seasonMiddleDegrees(1));
    expect(summer.x).toBeGreaterThan(0);
    expect(summer.y).toBeGreaterThan(0);
    const autumn = ringPoint(100, seasonMiddleDegrees(2));
    expect(autumn.x).toBeLessThan(0);
    expect(autumn.y).toBeGreaterThan(0);
    const winter = ringPoint(100, seasonMiddleDegrees(3));
    expect(winter.x).toBeLessThan(0);
    expect(winter.y).toBeLessThan(0);
  });
});

describe('the pieces of the year ring', () => {
  const radius = 96.5;
  const centre = 100;
  const year = (todayOfYear: number) => ringSegments(todayOfYear, radius, centre);

  it('has one piece for each day of the year', () => {
    const segments = year(0);
    expect(segments).toHaveLength(DAYS_PER_YEAR);
    expect(segments.map((segment) => segment.day)).toEqual(
      Array.from({ length: DAYS_PER_YEAR }, (_, index) => index + 1),
    );
  });

  it('gives each season its own six pieces, in order', () => {
    const segments = year(0);
    for (const [seasonIndex, season] of SEASONS.entries()) {
      const mine = segments.filter((segment) => segment.season === season);
      expect(mine).toHaveLength(DAYS_PER_SEASON);
      expect(mine.map((segment) => segment.dayOfSeason)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(mine.map((segment) => segment.day)).toEqual(
        Array.from({ length: DAYS_PER_SEASON }, (_, d) => seasonIndex * DAYS_PER_SEASON + d + 1),
      );
    }
    // Spring comes first, winter last.
    expect(segments[0]?.season).toBe('spring');
    expect(segments[DAYS_PER_YEAR - 1]?.season).toBe('winter');
  });

  it('lights days gone, today and days to come across the whole year', () => {
    const states = (today: number): string[] => year(today).map((segment) => segment.state);
    const count = (list: string[], state: string): number =>
      list.filter((entry) => entry === state).length;

    // First morning of the year: nothing gone, today, then 23 to come.
    expect(count(states(0), 'past')).toBe(0);
    expect(count(states(0), 'today')).toBe(1);
    expect(count(states(0), 'future')).toBe(DAYS_PER_YEAR - 1);

    // Day 4 of autumn: all of spring and summer, then three autumn days, have gone.
    const autumnDay4 = 2 * DAYS_PER_SEASON + 3;
    const list = states(autumnDay4);
    expect(count(list, 'past')).toBe(autumnDay4);
    expect(list[autumnDay4]).toBe('today');
    expect(list[autumnDay4 - 1]).toBe('past');
    expect(list[autumnDay4 + 1]).toBe('future');

    // The very last day of the year: all the rest have gone.
    expect(count(states(DAYS_PER_YEAR - 1), 'past')).toBe(DAYS_PER_YEAR - 1);
    expect(states(DAYS_PER_YEAR - 1)[DAYS_PER_YEAR - 1]).toBe('today');
  });

  it('starts spring just after the top and runs clockwise', () => {
    const [first, second] = year(0);
    const [firstX] = pathStart(first!.path);
    const [secondX] = pathStart(second!.path);
    // The first piece begins to the right of the top, and the next carries on further round.
    expect(firstX).toBeGreaterThan(centre);
    expect(secondX).toBeGreaterThan(firstX);
  });

  it('stops short of the top at the end, so the ring does not close up', () => {
    const segments = year(0);
    const [endX] = pathEnd(segments[DAYS_PER_YEAR - 1]!.path);
    const [startX] = pathStart(segments[0]!.path);
    // Winter's last piece finishes left of the top and spring's first starts right of it, with a season's gap between.
    expect(endX).toBeLessThan(centre);
    expect(startX).toBeGreaterThan(centre);
    expect(startX - endX).toBeCloseTo(
      2 * radius * Math.sin(((RING_SEASON_GAP_DEGREES / 2) * Math.PI) / 180),
      1,
    );
  });

  it('leaves a wider gap between seasons than between days, so the four read as four', () => {
    expect(RING_SEASON_GAP_DEGREES).toBeGreaterThan(RING_DAY_GAP_DEGREES);
    const segments = year(0);
    const gapAfter = (index: number): number => {
      const [endX, endY] = pathEnd(segments[index]!.path);
      const [startX, startY] = pathStart(segments[(index + 1) % DAYS_PER_YEAR]!.path);
      return Math.hypot(startX - endX, startY - endY);
    };
    // Between spring's last day and summer's first, against two days inside spring.
    const seasonGap = gapAfter(DAYS_PER_SEASON - 1);
    const dayGap = gapAfter(0);
    expect(seasonGap).toBeGreaterThan(dayGap);
    expect(seasonGap).toBeCloseTo(
      2 * radius * Math.sin(((RING_SEASON_GAP_DEGREES / 2) * Math.PI) / 180),
      1,
    );
    expect(dayGap).toBeCloseTo(
      2 * radius * Math.sin(((RING_DAY_GAP_DEGREES / 2) * Math.PI) / 180),
      1,
    );
  });

  it('puts the same number of gaps between seasons as there are seasons', () => {
    const segments = year(0);
    let wide = 0;
    for (let index = 0; index < DAYS_PER_YEAR; index += 1) {
      const [endX, endY] = pathEnd(segments[index]!.path);
      const [startX, startY] = pathStart(segments[(index + 1) % DAYS_PER_YEAR]!.path);
      if (Math.hypot(startX - endX, startY - endY) > 2 * radius * Math.sin(0.04)) wide += 1;
    }
    expect(wide).toBe(SEASONS.length);
  });
});

/** The numbers after `M` in a path made by `ringArc`. */
function pathStart(path: string): [number, number] {
  const [x, y] = /^M ([-\d.]+) ([-\d.]+)/.exec(path)!.slice(1).map(Number) as [number, number];
  return [x, y];
}

/** The last two numbers of a path made by `ringArc`. */
function pathEnd(path: string): [number, number] {
  return path.trim().split(' ').slice(-2).map(Number) as [number, number];
}
