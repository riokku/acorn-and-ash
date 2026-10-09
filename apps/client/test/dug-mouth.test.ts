import { describe, expect, it } from 'vitest';

import { MOUTH_RADIUS, roundedMouth, softEdge } from '../src/scene/dug-mouth';

const SIZE = 80;

/** A filled rectangle of dug samples, in a grid of solid ground. */
function rectangle(left: number, top: number, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(SIZE * SIZE);
  for (let row = top; row < top + height; row++)
    for (let column = left; column < left + width; column++) mask[row * SIZE + column] = 1;
  return mask;
}

const count = (mask: Uint8Array): number => mask.reduce((total, value) => total + value, 0);
const at = (mask: Uint8Array, column: number, row: number): number => mask[row * SIZE + column]!;

describe('the round mouth of a hole', () => {
  it('turns a one-metre square into a disc, leaving its corners out', () => {
    const square = rectangle(30, 30, 20, 20);
    const mouth = roundedMouth(square, SIZE);
    // The middle and the middle of each side are open ...
    expect(at(mouth, 40, 40)).toBe(1);
    expect(at(mouth, 31, 40)).toBe(1);
    expect(at(mouth, 40, 48)).toBe(1);
    // ... and the corners are not.
    expect(at(mouth, 30, 30)).toBe(0);
    expect(at(mouth, 49, 49)).toBe(0);
    // Roughly the area of a disc as wide as the square, a little over three quarters of it.
    expect(count(mouth) / count(square)).toBeGreaterThan(0.72);
    expect(count(mouth) / count(square)).toBeLessThan(0.86);
  });

  it('never reaches outside the squares that were dug', () => {
    const square = rectangle(20, 25, 40, 20);
    const mouth = roundedMouth(square, SIZE);
    for (let i = 0; i < mouth.length; i++) if (mouth[i] === 1) expect(square[i]).toBe(1);
  });

  it('keeps the inward corners of an L-shaped hole', () => {
    const l = rectangle(20, 20, 20, 40);
    for (let row = 40; row < 60; row++)
      for (let column = 40; column < 60; column++) l[row * SIZE + column] = 1;
    const mouth = roundedMouth(l, SIZE);
    expect(at(mouth, 41, 41)).toBe(1);
    expect(at(mouth, 39, 41)).toBe(1);
  });

  it('leaves a hole too small for the curve with a small mouth rather than none', () => {
    const tiny = rectangle(38, 38, 10, 10);
    expect(2 * MOUTH_RADIUS).toBeGreaterThan(10);
    expect(count(roundedMouth(tiny, SIZE))).toBeGreaterThan(0);
  });

  it('is empty where nothing was dug', () => {
    expect(count(roundedMouth(new Uint8Array(SIZE * SIZE), SIZE))).toBe(0);
  });
});

describe('the soft edge of a mouth', () => {
  it('is about a half at the lip, whole inside and nothing well away', () => {
    const mouth = roundedMouth(rectangle(20, 30, 40, 20), SIZE);
    const soft = softEdge(mouth, SIZE);
    expect(soft[40 * SIZE + 40]!).toBeGreaterThan(0.95);
    expect(soft[40 * SIZE + 20]!).toBeGreaterThan(0.4);
    expect(soft[40 * SIZE + 20]!).toBeLessThan(0.6);
    expect(soft[40 * SIZE + 8]!).toBe(0);
  });
});
