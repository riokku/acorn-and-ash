/**
 * The geometry of the season ring around the minimap (decision 0110): one arc
 * for each day of the season, running clockwise from the top, so the year's
 * progress reads like a clock hand going round the map.
 *
 * Plain numbers in, plain numbers out, so the drawing code has nothing to get
 * wrong and the shape can be tested without a browser.
 */

/** Which way each piece of the ring is lit. */
export type RingDayState = 'past' | 'today' | 'future';

export interface RingSegment {
  /** Which day of the season this piece stands for, from 1. */
  readonly day: number;
  readonly state: RingDayState;
  /** An SVG path for the arc, ready to stroke. */
  readonly path: string;
}

/** The empty slice between two pieces, in degrees, so the days read as separate. */
export const RING_GAP_DEGREES = 5;

/**
 * A point on a circle, with 0 degrees straight up and angles growing clockwise.
 * SVG's y axis points down, so up is a negative y.
 */
export function ringPoint(
  radius: number,
  degrees: number,
  centre = 0,
): { readonly x: number; readonly y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: centre + radius * Math.sin(radians), y: centre - radius * Math.cos(radians) };
}

/** An arc between two angles, drawn clockwise. Narrower than half a circle, so one arc command is enough. */
export function ringArc(
  radius: number,
  fromDegrees: number,
  toDegrees: number,
  centre = 0,
): string {
  const start = ringPoint(radius, fromDegrees, centre);
  const end = ringPoint(radius, toDegrees, centre);
  const largeArc = toDegrees - fromDegrees > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

/**
 * The pieces of the ring for a season: days gone are `past`, the day it is now
 * is `today` and the rest are `future`. The first piece starts at the top, just
 * after the gap, and the last ends just before it.
 */
export function ringSegments(
  daysInSeason: number,
  today: number,
  radius: number,
  centre = 0,
): readonly RingSegment[] {
  const slice = 360 / daysInSeason;
  return Array.from({ length: daysInSeason }, (_, index) => {
    const day = index + 1;
    const from = index * slice + RING_GAP_DEGREES / 2;
    const to = (index + 1) * slice - RING_GAP_DEGREES / 2;
    const state: RingDayState = day < today ? 'past' : day === today ? 'today' : 'future';
    return { day, state, path: ringArc(radius, from, to, centre) };
  });
}

/** Keeps the paths short and stable, so a test can read them. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
