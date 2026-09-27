import { describe, expect, it } from 'vitest';

import { seededRandom, tileableCells, tileableFbm, tileableNoise } from '../src/art/noise';
import { Raster, hex } from '../src/art/raster';
import {
  paintBark,
  paintBurlap,
  paintCobbles,
  paintForestFloor,
  paintFur,
  paintGrass,
  paintLogEnd,
  paintRipples,
  paintShingles,
  paintSoil,
  paintStone,
  paintWood,
} from '../src/art/recipes';

describe('tileable noise', () => {
  it('can repeat at a different rate down than across', () => {
    expect(tileableNoise(1.3, 2.2 + 3, 8, 1, 3)).toBeCloseTo(tileableNoise(1.3, 2.2, 8, 1, 3), 9);
    expect(tileableFbm(1.3, 2.2 + 3, 8, 3, 1, 3)).toBeCloseTo(tileableFbm(1.3, 2.2, 8, 3, 1, 3), 9);
  });

  it('gives the same value one period along, in either direction', () => {
    for (const [x, y] of [
      [0.3, 0.7],
      [2.25, 3.9],
      [5.5, 0.1],
    ] as const) {
      expect(tileableNoise(x + 8, y, 8, 1)).toBeCloseTo(tileableNoise(x, y, 8, 1), 9);
      expect(tileableNoise(x, y + 8, 8, 1)).toBeCloseTo(tileableNoise(x, y, 8, 1), 9);
      expect(tileableFbm(x + 4, y + 4, 4, 4, 2)).toBeCloseTo(tileableFbm(x, y, 4, 4, 2), 9);
      expect(tileableCells(x + 6, y, 6, 3).nearest).toBeCloseTo(
        tileableCells(x, y, 6, 3).nearest,
        9,
      );
    }
  });

  it('stays roughly within -1 to 1', () => {
    let lowest = 0;
    let highest = 0;
    for (let i = 0; i < 4000; i++) {
      const value = tileableNoise(i * 0.137, i * 0.071, 16, 5);
      lowest = Math.min(lowest, value);
      highest = Math.max(highest, value);
    }
    expect(lowest).toBeGreaterThan(-1.05);
    expect(highest).toBeLessThan(1.05);
    // And actually varies, rather than sitting flat.
    expect(highest - lowest).toBeGreaterThan(0.8);
  });

  it('comes out the same for the same seed, and differently for another', () => {
    expect(tileableNoise(1.3, 2.7, 8, 42)).toBe(tileableNoise(1.3, 2.7, 8, 42));
    expect(tileableNoise(1.3, 2.7, 8, 42)).not.toBe(tileableNoise(1.3, 2.7, 8, 43));
    const a = seededRandom(9);
    const b = seededRandom(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('painting on a raster', () => {
  it('carries a dab hanging off one edge round to the other', () => {
    const raster = new Raster(32);
    raster.dab(31.5, 16, 3, hex(0xffffff), 1, 1);
    expect(raster.get(0, 16)[0]).toBeGreaterThan(0.5);
    expect(raster.get(16, 16)[0]).toBe(0);
  });

  it('turns into four bytes a pixel, fully opaque', () => {
    const raster = new Raster(4);
    raster.fill((_u, _v, out) => {
      out[0] = 1;
      out[1] = 0.5;
      out[2] = 0;
    });
    const bytes = raster.toBytes();
    expect(bytes.length).toBe(4 * 4 * 4);
    expect([...bytes.slice(0, 4)]).toEqual([255, 128, 0, 255]);
  });
});

/**
 * How different the pixels either side of the wrap are, against how
 * different neighbouring pixels are on average everywhere else - across and
 * down, whichever is worse. About 1 for a texture with no seam at all.
 */
function seamRatio(raster: Raster): number {
  const { size } = raster;
  let worst = 0;
  for (const across of [true, false]) {
    const at = (along: number, i: number): readonly number[] =>
      across ? raster.get(along, i) : raster.get(i, along);
    const difference = (a: readonly number[], b: readonly number[]): number =>
      Math.abs((a[0] ?? 0) - (b[0] ?? 0)) +
      Math.abs((a[1] ?? 0) - (b[1] ?? 0)) +
      Math.abs((a[2] ?? 0) - (b[2] ?? 0));
    let seam = 0;
    let inside = 0;
    for (let i = 0; i < size; i++) {
      seam += difference(at(size - 1, i), at(0, i));
      for (let along = 0; along < size - 1; along++) {
        inside += difference(at(along, i), at(along + 1, i));
      }
    }
    worst = Math.max(worst, seam / Math.max(inside / (size - 1), 1e-6));
  }
  return worst;
}

describe('the painted textures', () => {
  const tiling = {
    grass: () => paintGrass(128),
    forestFloor: () => paintForestFloor(128),
    bark: () => paintBark(128),
    wood: () => paintWood(128),
    stone: () => paintStone(128),
    cobbles: () => paintCobbles(128),
    shingles: () => paintShingles(128),
    soil: () => paintSoil(128),
    burlap: () => paintBurlap(128),
    fur: () => paintFur(128),
    ripples: () => paintRipples(128),
  };

  for (const [name, paint] of Object.entries(tiling)) {
    it(`${name} tiles with no seam you could see`, () => {
      // Across the wrap, neighbouring pixels differ about as much as any two
      // neighbours inside do - not a hard line where one copy meets the next.
      expect(seamRatio(paint())).toBeLessThan(1.6);
    });
  }

  it('paints the same picture every time', () => {
    expect(paintGrass(64).toBytes()).toEqual(paintGrass(64).toBytes());
    expect(paintLogEnd(64).toBytes()).toEqual(paintLogEnd(64).toBytes());
  });

  it('keeps grass green and the forest floor brown', () => {
    const average = (raster: Raster): [number, number, number] => {
      const sum: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < raster.rgb.length; i += 3) {
        sum[0] += raster.rgb[i] ?? 0;
        sum[1] += raster.rgb[i + 1] ?? 0;
        sum[2] += raster.rgb[i + 2] ?? 0;
      }
      const count = raster.rgb.length / 3;
      return [sum[0] / count, sum[1] / count, sum[2] / count];
    };
    const [gr, gg, gb] = average(paintGrass(128));
    expect(gg).toBeGreaterThan(gr);
    expect(gg).toBeGreaterThan(gb);
    const [fr, fg, fb] = average(paintForestFloor(128));
    expect(fr).toBeGreaterThan(fb);
    expect(fr).toBeGreaterThanOrEqual(fg);
  });

  it('paints the full set at game size in well under a second', () => {
    const started = performance.now();
    paintGrass(512);
    paintForestFloor(512);
    paintBark(256);
    paintWood(512);
    paintLogEnd(256);
    paintStone(512);
    paintCobbles(256);
    paintShingles(512);
    paintSoil(256);
    paintBurlap(256);
    paintFur(256);
    paintRipples(256);
    const seconds = (performance.now() - started) / 1000;
    // Generous for a slow test machine; a real browser is a good deal faster.
    expect(seconds).toBeLessThan(4);
  });
});
