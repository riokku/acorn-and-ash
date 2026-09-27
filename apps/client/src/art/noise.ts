/**
 * Seeded, tileable noise for painting textures in code (see decision 0053).
 *
 * Every texture the game paints for itself repeats across the ground or a
 * wall, so every kind of noise here wraps around: whatever it gives at x = 0
 * it also gives at x = `period`, and the same for y. A texture painted from
 * it has no seam where one copy meets the next.
 *
 * Plain numbers in and out, no DOM and no Three.js, so it can be tested on its
 * own. Seeded rather than `Math.random`, so a texture comes out the same on
 * every load and in every browser.
 */

/** A small, fast, seeded random generator (mulberry32), for scattering things when painting. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole-number hash of a lattice point, for picking its gradient. */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Wraps a lattice coordinate into [0, period). */
function wrap(value: number, period: number): number {
  const wrapped = value % period;
  return wrapped < 0 ? wrapped + period : wrapped;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Eight evenly spread directions, one picked per lattice point. */
const GRADIENTS_X = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071];
const GRADIENTS_Y = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];

function gradientDot(ix: number, iy: number, dx: number, dy: number, seed: number): number {
  const index = hash2(ix, iy, seed) & 7;
  return (GRADIENTS_X[index] ?? 0) * dx + (GRADIENTS_Y[index] ?? 0) * dy;
}

/**
 * Smooth gradient noise, roughly in [-1, 1], repeating every `period` units
 * across and every `periodY` units down (the same as across, unless given).
 * Both must be whole numbers. Stretching a texture's grain one way - wood,
 * bark - means scaling y differently from x, and giving `periodY` to match.
 */
export function tileableNoise(
  x: number,
  y: number,
  period: number,
  seed: number,
  periodY = period,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ix0 = wrap(x0, period);
  const iy0 = wrap(y0, periodY);
  const ix1 = wrap(x0 + 1, period);
  const iy1 = wrap(y0 + 1, periodY);

  const n00 = gradientDot(ix0, iy0, fx, fy, seed);
  const n10 = gradientDot(ix1, iy0, fx - 1, fy, seed);
  const n01 = gradientDot(ix0, iy1, fx, fy - 1, seed);
  const n11 = gradientDot(ix1, iy1, fx - 1, fy - 1, seed);

  const u = fade(fx);
  const v = fade(fy);
  const bottom = n00 + (n10 - n00) * u;
  const top = n01 + (n11 - n01) * u;
  return (bottom + (top - bottom) * v) * 1.414;
}

/**
 * Several layers of `tileableNoise`, each twice as fine and half as strong as
 * the last - the soft, cloudy variation most painted surfaces start from.
 * Roughly in [-1, 1]. Still tiles, since every layer's period doubles too.
 */
export function tileableFbm(
  x: number,
  y: number,
  period: number,
  octaves: number,
  seed: number,
  periodY = period,
): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let scale = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum +=
      tileableNoise(x * scale, y * scale, period * scale, seed + octave * 101, periodY * scale) *
      amplitude;
    total += amplitude;
    amplitude *= 0.5;
    scale *= 2;
  }
  return sum / total;
}

/** What `tileableCells` finds about the nearest scattered point. */
export interface CellSample {
  /** How far to the nearest point. */
  readonly nearest: number;
  /** How far to the second nearest: `second - nearest` is small along the cracks between cells. */
  readonly second: number;
  /** A number in [0, 1) that is the same everywhere in one cell and different in the next. */
  readonly id: number;
}

/**
 * Cellular (Worley) noise: one point scattered in each square of a
 * `period`-by-`period` grid, wrapping at the edges. Good for cobbles, stones
 * and anything made of separate pieces. Distances are in grid squares.
 */
export function tileableCells(x: number, y: number, period: number, seed: number): CellSample {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let nearest = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox;
      const gy = cy + oy;
      const h = hash2(wrap(gx, period), wrap(gy, period), seed);
      const px = gx + (h & 0xffff) / 65536;
      const py = gy + (h >>> 16) / 65536;
      const distance = Math.hypot(px - x, py - y);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        id = hash2(wrap(gx, period), wrap(gy, period), seed + 7) / 4294967296;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return { nearest, second, id };
}

/** Smooth step from 0 at `edge0` to 1 at `edge1`. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Plain (non-tiling) value noise over the world, for colouring the ground by where it is. */
export function worldNoise(x: number, z: number, seed: number): number {
  // A period far larger than any world, so it never visibly repeats.
  return tileableNoise(x, z, 1 << 20, seed);
}

/** Several layers of `worldNoise`, for large, soft patches across the ground. */
export function worldFbm(x: number, z: number, octaves: number, seed: number): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let scale = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum += worldNoise(x * scale, z * scale, seed + octave * 131) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    scale *= 2;
  }
  return sum / total;
}
