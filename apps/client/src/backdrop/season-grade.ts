/**
 * Recolouring the painting for the time of year (decision 0106).
 *
 * The painting is one picture, so each season is made by changing its colours
 * rather than by painting four more. The greens of the forest are pulled toward
 * gold and red in autumn, dusted with frost in winter and freshened (with a
 * few blossoming trees) in spring; in winter the lake turns to ice. Summer is
 * the painting as it was made. The sky, the water and the far-off hills are
 * mostly left alone, apart from a light wash, so the picture stays the same
 * place all year round.
 *
 * Plain numbers in and out, no canvas, so it can be tested on its own. The
 * backdrop reads the painting's pixels once, grades them here, and keeps the
 * result.
 */

import { clamp, smoothstep, type SeasonId, type SeasonMix } from '@acorn/shared';

/** Red, green and blue, each from 0 to 1. */
export type Rgb = readonly [number, number, number];

export interface Grade {
  /** The hue, in degrees, that the greens are pulled toward. */
  readonly leafHue: number;
  /** How far toward it they go, from 0 (not at all) to 1 (all the way). */
  readonly leafPull: number;
  /** Multiplies how colourful the trees are. */
  readonly leafSaturation: number;
  /** Multiplies how bright the trees are. */
  readonly leafLight: number;
  /** How much of the lit side of the trees is under frost, from 0 to 1. */
  readonly frost: number;
  /** How much of the forest is in blossom, from 0 to 1. */
  readonly blossom: number;
  /** How much the lake has frozen over, from 0 to 1. */
  readonly ice: number;
  /** Multiplies the colour of the whole picture, sky included. */
  readonly wash: Rgb;
  /** Multiplies how colourful the whole picture is. */
  readonly saturation: number;
}

/** The painting exactly as it was made. */
export const AS_PAINTED: Grade = {
  leafHue: 120,
  leafPull: 0,
  leafSaturation: 1,
  leafLight: 1,
  frost: 0,
  blossom: 0,
  ice: 0,
  wash: [1, 1, 1],
  saturation: 1,
};

export const SEASON_GRADES: Readonly<Record<SeasonId, Grade>> = {
  // Fresh limes, a few trees in blossom, a softer and rosier sky.
  spring: {
    leafHue: 98,
    leafPull: 0.5,
    leafSaturation: 1.1,
    leafLight: 1.2,
    frost: 0,
    blossom: 0.8,
    ice: 0,
    wash: [1.04, 1.01, 1.03],
    saturation: 1.05,
  },
  // The painting as it is: deep greens in the warm gold of the evening.
  summer: AS_PAINTED,
  // Gold and russet through the forest, under a warmer, hazier sky.
  autumn: {
    leafHue: 26,
    leafPull: 0.92,
    leafSaturation: 1.45,
    leafLight: 1.45,
    frost: 0,
    blossom: 0,
    ice: 0,
    wash: [1.05, 0.97, 0.9],
    saturation: 1.05,
  },
  // Frosted boughs, an icy lake and a cool, quiet sky.
  winter: {
    leafHue: 192,
    leafPull: 0.5,
    leafSaturation: 0.55,
    leafLight: 1.1,
    frost: 1,
    blossom: 0,
    ice: 1,
    wash: [0.9, 0.97, 1.1],
    saturation: 0.82,
  },
};

/** True when grading would change nothing, so the painting can be shown as it is. */
export function isAsPainted(grade: Grade): boolean {
  return (
    grade.leafPull === 0 &&
    grade.leafSaturation === 1 &&
    grade.leafLight === 1 &&
    grade.frost === 0 &&
    grade.blossom === 0 &&
    grade.ice === 0 &&
    grade.saturation === 1 &&
    grade.wash.every((channel) => channel === 1)
  );
}

function mixNumber(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * The grade for a point on the way from one season to the next. The hue the
 * trees head for is weighed by how hard each season pulls toward it, so a
 * season that leaves the greens alone does not drag the other one's colour
 * toward some made-up in-between.
 */
export function mixGrades(from: Grade, to: Grade, amount: number): Grade {
  const fromPull = from.leafPull * (1 - amount);
  const toPull = to.leafPull * amount;
  const pulls = fromPull + toPull;
  return {
    leafHue: pulls === 0 ? to.leafHue : (from.leafHue * fromPull + to.leafHue * toPull) / pulls,
    leafPull: mixNumber(from.leafPull, to.leafPull, amount),
    leafSaturation: mixNumber(from.leafSaturation, to.leafSaturation, amount),
    leafLight: mixNumber(from.leafLight, to.leafLight, amount),
    frost: mixNumber(from.frost, to.frost, amount),
    blossom: mixNumber(from.blossom, to.blossom, amount),
    ice: mixNumber(from.ice, to.ice, amount),
    wash: [
      mixNumber(from.wash[0], to.wash[0], amount),
      mixNumber(from.wash[1], to.wash[1], amount),
      mixNumber(from.wash[2], to.wash[2], amount),
    ],
    saturation: mixNumber(from.saturation, to.saturation, amount),
  };
}

/** What the painting should look like for this point in the year. */
export function gradeFor(mix: SeasonMix): Grade {
  return mixGrades(SEASON_GRADES[mix.from], SEASON_GRADES[mix.to], mix.amount);
}

// --- Reading the painting -------------------------------------------------

/** The distance, in painted pixels, between the points the soft colour patches are made from. */
const PATCH = 44;

function latticeValue(column: number, row: number, salt: number): number {
  let hash = Math.imul(column + 374761393, 668265263) ^ Math.imul(row + 2246822519, 3266489917);
  hash = Math.imul(hash ^ (hash >>> 13) ^ salt, 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/**
 * Soft, slowly changing patches from 0 to 1, a bit bigger than a tree. This is
 * what makes one tree turn red and its neighbour gold, and a few go pink in
 * spring, instead of the whole forest changing in step.
 */
export function patchAt(x: number, y: number, salt: number): number {
  const column = Math.floor(x / PATCH);
  const row = Math.floor(y / PATCH);
  const across = smoothstep(x / PATCH - column, 0, 1);
  const down = smoothstep(y / PATCH - row, 0, 1);
  const top =
    latticeValue(column, row, salt) * (1 - across) + latticeValue(column + 1, row, salt) * across;
  const bottom =
    latticeValue(column, row + 1, salt) * (1 - across) +
    latticeValue(column + 1, row + 1, salt) * across;
  return top * (1 - down) + bottom * down;
}

/** The hue, from 0 to 360, saturation and value, each from 0 to 1, of a colour. */
function toHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  let hue = 0;
  if (spread > 0) {
    if (max === r) hue = ((g - b) / spread) % 6;
    else if (max === g) hue = (b - r) / spread + 2;
    else hue = (r - g) / spread + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max === 0 ? 0 : spread / max, max];
}

function fromHsv(hue: number, saturation: number, value: number): [number, number, number] {
  const chroma = value * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = value - chroma;
  let r = 0;
  let g = 0;
  let b = 0;
  if (sector < 1) [r, g, b] = [chroma, second, 0];
  else if (sector < 2) [r, g, b] = [second, chroma, 0];
  else if (sector < 3) [r, g, b] = [0, chroma, second];
  else if (sector < 4) [r, g, b] = [0, second, chroma];
  else if (sector < 5) [r, g, b] = [second, 0, chroma];
  else [r, g, b] = [chroma, 0, second];
  return [r + base, g + base, b + base];
}

/** The shortest way round the colour wheel from one hue to another, from -180 to 180. */
function hueGap(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** How much a pixel is part of a tree: greens and yellow-greens, not sky, water or windows. */
function foliageWeight(
  hue: number,
  saturation: number,
  value: number,
  heightShare: number,
): number {
  const colour = smoothstep(hue, 28, 52) * (1 - smoothstep(hue, 164, 178));
  if (colour === 0) return 0;
  const sky = 1 - smoothstep(heightShare, 0.45, 0.58);
  const lamp = (1 - smoothstep(hue, 48, 62)) * smoothstep(value, 0.45, 0.7);
  return (
    colour *
    smoothstep(saturation, 0.12, 0.3) *
    (1 - sky * smoothstep(value, 0.6, 0.8)) *
    (1 - lamp)
  );
}

/** How much a pixel is the lake: the teal of deep water in the lower part of the picture. */
function waterWeight(hue: number, saturation: number, value: number, heightShare: number): number {
  return (
    smoothstep(hue, 168, 176) *
    (1 - smoothstep(hue, 198, 208)) *
    smoothstep(saturation, 0.3, 0.45) *
    smoothstep(heightShare, 0.64, 0.7) *
    (1 - smoothstep(value, 0.4, 0.55))
  );
}

/**
 * Where the lake is, as a list of painted pixel positions (every few pixels),
 * so the sparkles on the water only ever land on water.
 */
export function findWater(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  step = 6,
): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const at = (y * width + x) * 4;
      const [hue, saturation, value] = toHsv(
        (pixels[at] ?? 0) / 255,
        (pixels[at + 1] ?? 0) / 255,
        (pixels[at + 2] ?? 0) / 255,
      );
      if (waterWeight(hue, saturation, value, y / height) > 0.9) found.push({ x, y });
    }
  }
  return found;
}

/** The width and height, in painted pixels, of one square of the lake map. */
const LAKE_CELL = 8;

/** How much of each small square of the picture is lake, softened so its edge is a gentle slope. */
export interface LakeMap {
  readonly columns: number;
  readonly rows: number;
  readonly share: Float32Array;
}

/**
 * Work out where the lake is, as a soft map, so winter's ice covers the whole
 * lake evenly, reflections of trees and all, instead of speckling wherever a
 * single pixel's colour happens to look like water.
 */
export function mapLake(source: Uint8ClampedArray, width: number, height: number): LakeMap {
  const columns = Math.ceil(width / LAKE_CELL);
  const rows = Math.ceil(height / LAKE_CELL);
  let share: Float32Array = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let wet = 0;
      let looked = 0;
      for (let y = row * LAKE_CELL; y < Math.min(height, (row + 1) * LAKE_CELL); y += 2) {
        for (let x = column * LAKE_CELL; x < Math.min(width, (column + 1) * LAKE_CELL); x += 2) {
          const at = (y * width + x) * 4;
          const [hue, saturation, value] = toHsv(
            (source[at] ?? 0) / 255,
            (source[at + 1] ?? 0) / 255,
            (source[at + 2] ?? 0) / 255,
          );
          looked += 1;
          if (waterWeight(hue, saturation, value, y / height) > 0.5) wet += 1;
        }
      }
      share[row * columns + column] = looked === 0 ? 0 : wet / looked;
    }
  }
  // Two rounds of blurring, across and then down, spread each square into its
  // neighbours so the edge of the lake fades over a few squares.
  for (let round = 0; round < 2; round++) share = blurLake(share, columns, rows);
  return { columns, rows, share };
}

function blurLake(share: Float32Array, columns: number, rows: number): Float32Array {
  const across = new Float32Array(share.length);
  const down = new Float32Array(share.length);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let sum = 0;
      for (let d = -2; d <= 2; d++) {
        sum += share[row * columns + clamp(column + d, 0, columns - 1)] ?? 0;
      }
      across[row * columns + column] = sum / 5;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let sum = 0;
      for (let d = -2; d <= 2; d++) {
        sum += across[clamp(row + d, 0, rows - 1) * columns + column] ?? 0;
      }
      down[row * columns + column] = sum / 5;
    }
  }
  return down;
}

/** How much of the lake is at this painted pixel, from 0 to 1, smoothly. */
export function lakeAt(map: LakeMap, x: number, y: number): number {
  const fx = clamp(x / LAKE_CELL - 0.5, 0, map.columns - 1);
  const fy = clamp(y / LAKE_CELL - 0.5, 0, map.rows - 1);
  const column = Math.min(map.columns - 2, Math.floor(fx));
  const row = Math.min(map.rows - 2, Math.floor(fy));
  const across = fx - column;
  const down = fy - row;
  const at = (r: number, c: number): number => map.share[r * map.columns + c] ?? 0;
  const top = at(row, column) * (1 - across) + at(row, column + 1) * across;
  const bottom = at(row + 1, column) * (1 - across) + at(row + 1, column + 1) * across;
  return smoothstep(top * (1 - down) + bottom * down, 0.3, 0.7);
}

const FROST: Rgb = [0.8, 0.89, 0.98];
const ICE: Rgb = [0.6, 0.79, 0.86];
const BLOSSOM_HUE = 345;

/**
 * Grade the painting: read `source` (RGBA, as a canvas gives it) and write the
 * result to `target`, which may be the same array.
 */
export function gradePixels(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  width: number,
  height: number,
  grade: Grade,
): void {
  const lake = grade.ice > 0 ? mapLake(source, width, height) : null;
  for (let y = 0; y < height; y++) {
    const heightShare = y / height;
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      let r = (source[at] ?? 0) / 255;
      let g = (source[at + 1] ?? 0) / 255;
      let b = (source[at + 2] ?? 0) / 255;
      const [hue, saturation, value] = toHsv(r, g, b);

      // Under the ice, a tree's reflection is part of the lake, not a tree.
      const frozen = lake === null ? 0 : lakeAt(lake, x, y) * grade.ice;
      const tree = foliageWeight(hue, saturation, value, heightShare) * (1 - frozen);
      if (tree > 0) {
        // Each tree heads for a slightly different hue, brighter leaves toward
        // yellow, so the forest is a patchwork and not one flat colour.
        const aim =
          grade.leafHue + (value - 0.3) * 40 + (patchAt(x, y, 1) - 0.5) * 36 * grade.leafPull;
        [r, g, b] = fromHsv(
          hue + hueGap(hue, aim) * grade.leafPull * tree,
          clamp(saturation * (1 + (grade.leafSaturation - 1) * tree), 0, 1),
          clamp(value * (1 + (grade.leafLight - 1) * tree), 0, 1),
        );

        const blossoming = tree * grade.blossom * smoothstep(patchAt(x, y, 2), 0.6, 0.72);
        if (blossoming > 0) {
          const [pr, pg, pb] = fromHsv(BLOSSOM_HUE, 0.3, clamp(value * 2.2 + 0.4, 0, 0.95));
          const lit = blossoming * smoothstep(value, 0.1, 0.3) * 0.8;
          [r, g, b] = [r + (pr - r) * lit, g + (pg - g) * lit, b + (pb - b) * lit];
        }

        const frosted = tree * grade.frost * smoothstep(value, 0.1, 0.45) * 0.75;
        if (frosted > 0) {
          const shine = clamp(0.5 + value * 0.9, 0, 1.05);
          r += (FROST[0] * shine - r) * frosted;
          g += (FROST[1] * shine - g) * frosted;
          b += (FROST[2] * shine - b) * frosted;
        }
      }
      if (frozen > 0) {
        // The same light and dark as before, in the colour of ice.
        const shine = 0.35 + value * 1.6;
        const ice = frozen * 0.6;
        r += (ICE[0] * shine - r) * ice;
        g += (ICE[1] * shine - g) * ice;
        b += (ICE[2] * shine - b) * ice;
      }

      if (grade.saturation !== 1) {
        const grey = r * 0.3 + g * 0.59 + b * 0.11;
        r = grey + (r - grey) * grade.saturation;
        g = grey + (g - grey) * grade.saturation;
        b = grey + (b - grey) * grade.saturation;
      }

      target[at] = clamp(r * grade.wash[0], 0, 1) * 255;
      target[at + 1] = clamp(g * grade.wash[1], 0, 1) * 255;
      target[at + 2] = clamp(b * grade.wash[2], 0, 1) * 255;
      target[at + 3] = source[at + 3] ?? 255;
    }
  }
}
