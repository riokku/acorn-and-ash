import { describe, expect, it } from 'vitest';

import { SEASONS } from '@acorn/shared';

import {
  AS_PAINTED,
  SEASON_GRADES,
  findWater,
  gradeFor,
  gradePixels,
  isAsPainted,
  lakeAt,
  mapLake,
  mixGrades,
  patchAt,
} from '../src/backdrop/season-grade';

/** A painting of one flat colour, as the RGBA bytes a canvas gives. */
function flat(width: number, height: number, rgb: readonly [number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  return pixels;
}

function graded(rgb: readonly [number, number, number], season: keyof typeof SEASON_GRADES) {
  // Taller than half so the pixel is in the part of the picture where trees stand, not sky.
  const source = flat(4, 4, rgb);
  const target = new Uint8ClampedArray(source.length);
  gradePixels(source, target, 4, 4, SEASON_GRADES[season]);
  return [target[0] ?? 0, target[1] ?? 0, target[2] ?? 0] as const;
}

/** A mossy mid-green, like the painted trees. */
const TREE_GREEN = [40, 90, 50] as const;
/** The deep teal of the painted lake. */
const WATER_TEAL = [26, 68, 72] as const;

describe('the season grades', () => {
  it('has one for every season, and summer is the painting as it was made', () => {
    expect(Object.keys(SEASON_GRADES).sort()).toEqual([...SEASONS].sort());
    expect(SEASON_GRADES.summer).toBe(AS_PAINTED);
    expect(isAsPainted(SEASON_GRADES.summer)).toBe(true);
    expect(isAsPainted(SEASON_GRADES.autumn)).toBe(false);
    expect(isAsPainted(SEASON_GRADES.winter)).toBe(false);
  });

  it('leaves the picture exactly alone in summer', () => {
    const source = flat(4, 4, TREE_GREEN);
    const target = new Uint8ClampedArray(source.length);
    gradePixels(source, target, 4, 4, AS_PAINTED);
    expect([...target]).toEqual([...source]);
  });

  it('turns green trees gold and red in autumn', () => {
    const [r, g, b] = graded(TREE_GREEN, 'autumn');
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('frosts the lit side of the trees in winter, and leaves the shade dark', () => {
    const [lr, lg, lb] = graded([70, 140, 80], 'winter');
    // Frosted: pale, and with more blue than the green it started as.
    expect(lb).toBeGreaterThan(lr);
    expect(Math.min(lr, lg, lb)).toBeGreaterThan(60);
    const [dr, dg, db] = graded([6, 14, 8], 'winter');
    expect(Math.max(dr, dg, db)).toBeLessThan(70);
  });

  it('freshens the greens in spring, with only a few trees in blossom', () => {
    const source = flat(240, 240, TREE_GREEN);
    const target = new Uint8ClampedArray(source.length);
    gradePixels(source, target, 240, 240, SEASON_GRADES.spring);
    let green = 0;
    for (let i = 0; i < 240 * 240; i++) {
      const r = target[i * 4] ?? 0;
      const g = target[i * 4 + 1] ?? 0;
      if (g >= r) green += 1;
    }
    expect(green / (240 * 240)).toBeGreaterThan(0.6);
  });

  it('keeps the sky mostly as painted, only washing it with the season', () => {
    const sky = flat(4, 4, [254, 199, 145]);
    const target = new Uint8ClampedArray(sky.length);
    // The first row of the picture is high up, where the sky is.
    gradePixels(sky, target, 4, 4, SEASON_GRADES.autumn);
    expect(target[0]).toBeGreaterThan(200);
    expect(target[0]).toBeGreaterThan(target[2] ?? 0);
  });

  it('keeps every colour inside the range a canvas can hold', () => {
    for (const season of SEASONS) {
      for (const colour of [TREE_GREEN, WATER_TEAL, [255, 255, 255], [0, 0, 0]] as const) {
        for (const channel of graded(colour, season)) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('keeps the transparency of every pixel', () => {
    const source = flat(2, 2, TREE_GREEN);
    source[3] = 17;
    const target = new Uint8ClampedArray(source.length);
    gradePixels(source, target, 2, 2, SEASON_GRADES.autumn);
    expect(target[3]).toBe(17);
  });
});

describe('easing from one season into the next', () => {
  it('is the first season at the start and the second at the end', () => {
    expect(mixGrades(SEASON_GRADES.summer, SEASON_GRADES.autumn, 0).leafPull).toBe(0);
    const end = mixGrades(SEASON_GRADES.summer, SEASON_GRADES.autumn, 1);
    expect(end.leafPull).toBe(SEASON_GRADES.autumn.leafPull);
    expect(end.leafHue).toBe(SEASON_GRADES.autumn.leafHue);
  });

  it('does not drag the autumn gold toward a made-up hue when the other season leaves the greens alone', () => {
    const half = mixGrades(SEASON_GRADES.summer, SEASON_GRADES.autumn, 0.5);
    expect(half.leafHue).toBeCloseTo(SEASON_GRADES.autumn.leafHue);
    expect(half.leafPull).toBeCloseTo(SEASON_GRADES.autumn.leafPull / 2);
  });

  it('works the grade out from a season mix', () => {
    const mix = { from: 'autumn', to: 'winter', amount: 0 } as const;
    expect(gradeFor(mix).frost).toBe(0);
    expect(gradeFor({ ...mix, amount: 1 }).frost).toBe(SEASON_GRADES.winter.frost);
  });
});

describe('finding the lake', () => {
  /** Water in the lower half of a picture, sky above. */
  function lakeAndSky(width: number, height: number): Uint8ClampedArray {
    const pixels = flat(width, height, [254, 199, 145]);
    for (let y = Math.floor(height * 0.75); y < height; y++) {
      for (let x = 0; x < width; x++) pixels.set([...WATER_TEAL, 255], (y * width + x) * 4);
    }
    return pixels;
  }

  it('finds water in the lower part of the picture and not in the sky', () => {
    const found = findWater(lakeAndSky(100, 100), 100, 100, 5);
    expect(found.length).toBeGreaterThan(0);
    for (const spot of found) expect(spot.y).toBeGreaterThanOrEqual(75);
  });

  it('does not take teal high up, like a far hill, for the lake', () => {
    const hills = flat(100, 100, WATER_TEAL);
    const found = findWater(hills, 100, 100, 5);
    for (const spot of found) expect(spot.y).toBeGreaterThanOrEqual(64);
  });

  it('maps the lake softly: full inside, empty far outside, in between at the edge', () => {
    const map = mapLake(lakeAndSky(160, 160), 160, 160);
    expect(lakeAt(map, 80, 150)).toBeGreaterThan(0.9);
    expect(lakeAt(map, 80, 10)).toBe(0);
    const edge = lakeAt(map, 80, 120);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it('freezes the lake in winter and not in summer', () => {
    const source = lakeAndSky(160, 160);
    const winter = new Uint8ClampedArray(source.length);
    const summer = new Uint8ClampedArray(source.length);
    gradePixels(source, winter, 160, 160, SEASON_GRADES.winter);
    gradePixels(source, summer, 160, 160, AS_PAINTED);
    const at = (150 * 160 + 80) * 4;
    // Ice is paler than the deep water it covers.
    expect(winter[at + 1]).toBeGreaterThan((summer[at + 1] ?? 0) + 15);
  });
});

describe('patches of colour', () => {
  it('stays between 0 and 1, and is the same every time', () => {
    for (let i = 0; i < 200; i++) {
      const value = patchAt(i * 13.7, i * 5.1, 1);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(patchAt(i * 13.7, i * 5.1, 1)).toBe(value);
    }
  });

  it('changes slowly across the picture, so neighbouring pixels agree', () => {
    expect(Math.abs(patchAt(500, 400, 1) - patchAt(501, 400, 1))).toBeLessThan(0.05);
  });
});
