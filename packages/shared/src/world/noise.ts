/**
 * Deterministic 2D noise.
 *
 * Terrain height and how thick the wilderness grows both need a "random but
 * smooth" number at an arbitrary point in the world, not just the next one in
 * a sequence. The `Rng` in `rng.ts` only ever gives you the next draw, so this
 * hashes a position directly instead: the same `(seed, x, z)` always gives the
 * same answer, asked in any order, from the server or from any browser.
 */

/**
 * A strong integer hash (lowbias32), used to turn a lattice point into a value
 * with no visible pattern between neighbours.
 */
function hashUint32(input: number): number {
  let x = input >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** One point on the integer lattice, hashed to a value in [0, 1). */
function latticeValue(seed: number, ix: number, iz: number): number {
  const withSeed = hashUint32(seed >>> 0);
  const withX = hashUint32(withSeed + (ix | 0));
  const withZ = hashUint32(withX + (iz | 0));
  return withZ / 4294967296;
}

/** Ease with zero slope at both ends, so tiles meet without a visible seam. */
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth value noise in [0, 1), continuous everywhere.
 *
 * The four corners of the lattice cell containing `(x, z)` are hashed, then
 * blended by how far into the cell the point is.
 */
export function valueNoise2D(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);

  const v00 = latticeValue(seed, x0, z0);
  const v10 = latticeValue(seed, x0 + 1, z0);
  const v01 = latticeValue(seed, x0, z0 + 1);
  const v11 = latticeValue(seed, x0 + 1, z0 + 1);

  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), tz);
}

/**
 * Several octaves of value noise summed together, still in [0, 1).
 *
 * Each octave doubles in frequency and halves in strength, which is what
 * turns single-scale noise into something that reads as terrain: broad rises
 * with smaller detail on top of them, rather than one even wobble.
 */
export function fractalNoise2D(seed: number, x: number, z: number, octaves = 4): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    // Each octave is hashed as though it were an unrelated noise field, so
    // the detail layers do not just look like a scaled copy of the first.
    sum += valueNoise2D(seed + i * 101, x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / max;
}
