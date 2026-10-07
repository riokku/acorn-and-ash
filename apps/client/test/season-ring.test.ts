import { describe, expect, it } from 'vitest';

import { DAYS_PER_SEASON } from '@acorn/shared';

import { RING_GAP_DEGREES, ringArc, ringPoint, ringSegments } from '../src/hud/season-ring';

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

describe('the pieces of the season ring', () => {
  const radius = 96.5;
  const centre = 100;

  it('has one piece for each day of the season', () => {
    const segments = ringSegments(DAYS_PER_SEASON, 1, radius, centre);
    expect(segments).toHaveLength(DAYS_PER_SEASON);
    expect(segments.map((segment) => segment.day)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lights days gone, today and days to come', () => {
    const states = (today: number): string[] =>
      ringSegments(DAYS_PER_SEASON, today, radius, centre).map((segment) => segment.state);
    expect(states(1)).toEqual(['today', 'future', 'future', 'future', 'future', 'future']);
    expect(states(3)).toEqual(['past', 'past', 'today', 'future', 'future', 'future']);
    expect(states(6)).toEqual(['past', 'past', 'past', 'past', 'past', 'today']);
  });

  it('starts the first day just after the top and runs clockwise', () => {
    const [first, second] = ringSegments(DAYS_PER_SEASON, 1, radius, centre);
    const start = ringPoint(radius, RING_GAP_DEGREES / 2, centre);
    expect(first?.path.startsWith(`M ${Math.round(start.x * 100) / 100} `)).toBe(true);
    // The first piece begins right of the top (x past the middle), and the second carries on from there.
    expect(start.x).toBeGreaterThan(centre);
    const secondStart = ringPoint(radius, 60 + RING_GAP_DEGREES / 2, centre);
    expect(second?.path.startsWith(`M ${Math.round(secondStart.x * 100) / 100} `)).toBe(true);
  });

  it('stops short of the top at the end, so the ring does not close up', () => {
    const segments = ringSegments(DAYS_PER_SEASON, 1, radius, centre);
    const last = segments[segments.length - 1];
    const first = segments[0];
    expect(last).toBeDefined();
    expect(first).toBeDefined();
    const [endX] = pathEnd(last!.path);
    const [startX] = pathStart(first!.path);
    // The last piece finishes left of the top and the first starts right of it, with the gap between.
    expect(endX).toBeLessThan(centre);
    expect(startX).toBeGreaterThan(centre);
    expect(startX - endX).toBeCloseTo(
      2 * radius * Math.sin(((RING_GAP_DEGREES / 2) * Math.PI) / 180),
      1,
    );
  });

  it('works for a season of any length', () => {
    expect(ringSegments(4, 2, radius, centre).map((segment) => segment.state)).toEqual([
      'past',
      'today',
      'future',
      'future',
    ]);
  });
});

/** The numbers after `M` in a path made by `ringArc`. */
function pathStart(path: string): [number, number] {
  const [x, y] = /^M ([-\d.]+) ([-\d.]+)/.exec(path)!.slice(1).map(Number) as [number, number];
  return [x, y];
}

/** The last two numbers of a path made by `ringArc`. */
function pathEnd(path: string): [number, number] {
  const numbers = path.trim().split(' ').slice(-2).map(Number) as [number, number];
  return numbers;
}
