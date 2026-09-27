/**
 * The blank parchment laid over whatever a player has not explored yet (see
 * decision 0054), worked out from their explored map.
 *
 * Soft and a little ragged at the edge, like a wash that has not been
 * painted that far yet, rather than a grid of squares switching on.
 */

import {
  EXPLORE_CELL_SIZE,
  EXPLORE_GRID_SIZE,
  PLAYABLE_HALF_EXTENT,
  isCellExplored,
} from '@acorn/shared';

import { smoothstep, worldNoise } from '../art/noise';
import { MAP_HALF_EXTENT } from './paint-map';

/** Pixels along each side of the fog: about a metre and a quarter each, blended smoothly when drawn larger. */
export const FOG_RESOLUTION = 256;

/**
 * How covered each pixel of the map is, from 0 (explored, the painting shows
 * through) to 255 (unexplored, bare parchment), row by row across the same
 * square the painted map covers.
 */
export function fogCover(
  explored: Uint8Array,
  resolution: number = FOG_RESOLUTION,
): Uint8ClampedArray {
  const cover = new Uint8ClampedArray(resolution * resolution);
  const metresPerPixel = (MAP_HALF_EXTENT * 2) / resolution;
  const ragged = raggednessFor(resolution);

  // Every square as 0 or 1, with a border of unseen squares all the way
  // round, so blending near the edge of the world never reads past the end.
  const side = EXPLORE_GRID_SIZE + 2;
  const seen = new Float32Array(side * side);
  for (let row = 0; row < EXPLORE_GRID_SIZE; row++) {
    for (let column = 0; column < EXPLORE_GRID_SIZE; column++) {
      if (isCellExplored(explored, row * EXPLORE_GRID_SIZE + column)) {
        seen[(row + 1) * side + column + 1] = 1;
      }
    }
  }
  const lastCell = side - 2;
  softenOnce(seen, side);

  for (let py = 0; py < resolution; py++) {
    const z = (py + 0.5) * metresPerPixel - MAP_HALF_EXTENT;
    // +1 for the border, -0.5 to blend between squares' middles.
    const fz = Math.min(
      lastCell,
      Math.max(0, (z + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE + 0.5),
    );
    const row = Math.floor(fz);
    const tz = fz - row;
    for (let px = 0; px < resolution; px++) {
      const x = (px + 0.5) * metresPerPixel - MAP_HALF_EXTENT;
      const fx = Math.min(
        lastCell,
        Math.max(0, (x + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE + 0.5),
      );
      const column = Math.floor(fx);
      const tx = fx - column;
      const at = row * side + column;
      // How much of the neighbourhood has been seen, blended between the
      // middles of the four nearest squares.
      const top = (seen[at] ?? 0) * (1 - tx) + (seen[at + 1] ?? 0) * tx;
      const bottom = (seen[at + side] ?? 0) * (1 - tx) + (seen[at + side + 1] ?? 0) * tx;
      // A ragged, painterly edge rather than a smooth fade.
      const edge = top * (1 - tz) + bottom * tz + (ragged[py * resolution + px] ?? 0);
      cover[py * resolution + px] = 255 - 255 * smoothstep(0.3, 0.7, edge);
    }
  }
  return cover;
}

/**
 * A light blur over the squares, across then down, so the edge of what has
 * been seen comes out round rather than stepped along the grid.
 */
function softenOnce(values: Float32Array, side: number): void {
  const scratch = new Float32Array(values.length);
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const at = row * side + column;
      const left = column > 0 ? (values[at - 1] ?? 0) : 0;
      const right = column < side - 1 ? (values[at + 1] ?? 0) : 0;
      scratch[at] = (values[at] ?? 0) * 0.5 + (left + right) * 0.25;
    }
  }
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const at = row * side + column;
      const up = row > 0 ? (scratch[at - side] ?? 0) : 0;
      const down = row < side - 1 ? (scratch[at + side] ?? 0) : 0;
      values[at] = (scratch[at] ?? 0) * 0.5 + (up + down) * 0.25;
    }
  }
}

/**
 * The same raggedness every time for a given pixel, so it is worked out
 * once and kept: redoing it would cost most of the time the fog takes, every
 * time the player steps into a new square.
 */
const raggednessByResolution = new Map<number, Float32Array>();

function raggednessFor(resolution: number): Float32Array {
  const cached = raggednessByResolution.get(resolution);
  if (cached !== undefined) return cached;
  const values = new Float32Array(resolution * resolution);
  const metresPerPixel = (MAP_HALF_EXTENT * 2) / resolution;
  for (let py = 0; py < resolution; py++) {
    const z = (py + 0.5) * metresPerPixel - MAP_HALF_EXTENT;
    for (let px = 0; px < resolution; px++) {
      const x = (px + 0.5) * metresPerPixel - MAP_HALF_EXTENT;
      values[py * resolution + px] = worldNoise(x * 0.12, z * 0.12, 311) * 0.22;
    }
  }
  raggednessByResolution.set(resolution, values);
  return values;
}
