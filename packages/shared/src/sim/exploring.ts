/**
 * Which parts of the world a player has seen (see decision 0054).
 *
 * The playable square is diced into `EXPLORE_CELL_SIZE` squares, one bit
 * each, so the whole world fits in well under a kilobyte: small enough to
 * save with the player and send whole whenever it grows. Plain bytes and
 * plain numbers, so the server decides it, saves it and sends it, and the
 * player's own browser can fill its map in ahead of hearing back.
 */

import { EXPLORE_CELL_SIZE, EXPLORE_REVEAL_RADIUS, PLAYABLE_HALF_EXTENT } from '../constants';

/** Squares along each side of the explored map. */
export const EXPLORE_GRID_SIZE = Math.ceil((PLAYABLE_HALF_EXTENT * 2) / EXPLORE_CELL_SIZE);
/** How many bytes one player's explored map takes. */
export const EXPLORED_BYTES = Math.ceil((EXPLORE_GRID_SIZE * EXPLORE_GRID_SIZE) / 8);

/** A fresh map with nothing seen yet. */
export function createExploredMap(): Uint8Array {
  return new Uint8Array(EXPLORED_BYTES);
}

/**
 * A saved map, if it is the right size for this build of the game; a fresh
 * one otherwise. A world that ever changes its size or square size starts
 * everybody's map over rather than reading one square as another.
 */
export function exploredMapFrom(saved: Uint8Array | null | undefined): Uint8Array {
  if (saved === null || saved === undefined || saved.length !== EXPLORED_BYTES) {
    return createExploredMap();
  }
  return new Uint8Array(saved);
}

/** Which square a spot is in, as one number, or null past the edge of the world. */
export function exploreCellAt(x: number, z: number): number | null {
  const column = Math.floor((x + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE);
  const row = Math.floor((z + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE);
  if (column < 0 || row < 0 || column >= EXPLORE_GRID_SIZE || row >= EXPLORE_GRID_SIZE) {
    return null;
  }
  return row * EXPLORE_GRID_SIZE + column;
}

/** The middle of a square, in world metres. */
export function exploreCellCentre(cell: number): { x: number; z: number } {
  const column = cell % EXPLORE_GRID_SIZE;
  const row = Math.floor(cell / EXPLORE_GRID_SIZE);
  return {
    x: (column + 0.5) * EXPLORE_CELL_SIZE - PLAYABLE_HALF_EXTENT,
    z: (row + 0.5) * EXPLORE_CELL_SIZE - PLAYABLE_HALF_EXTENT,
  };
}

export function isCellExplored(map: Uint8Array, cell: number): boolean {
  return ((map[cell >> 3] ?? 0) & (1 << (cell & 7))) !== 0;
}

/** Whether the square a spot is in has been seen. Past the edge of the world never has. */
export function isExploredAt(map: Uint8Array, x: number, z: number): boolean {
  const cell = exploreCellAt(x, z);
  return cell !== null && isCellExplored(map, cell);
}

/**
 * Mark everything within `radius` of a spot as seen. Returns how many
 * squares were new, so a caller only has to say something when there were.
 */
export function revealAround(
  map: Uint8Array,
  x: number,
  z: number,
  radius: number = EXPLORE_REVEAL_RADIUS,
): number {
  const reach = Math.ceil(radius / EXPLORE_CELL_SIZE) + 1;
  const centreColumn = Math.floor((x + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE);
  const centreRow = Math.floor((z + PLAYABLE_HALF_EXTENT) / EXPLORE_CELL_SIZE);
  const radiusSquared = radius * radius;
  let revealed = 0;
  for (let row = centreRow - reach; row <= centreRow + reach; row++) {
    if (row < 0 || row >= EXPLORE_GRID_SIZE) continue;
    const middleZ = (row + 0.5) * EXPLORE_CELL_SIZE - PLAYABLE_HALF_EXTENT;
    for (let column = centreColumn - reach; column <= centreColumn + reach; column++) {
      if (column < 0 || column >= EXPLORE_GRID_SIZE) continue;
      const middleX = (column + 0.5) * EXPLORE_CELL_SIZE - PLAYABLE_HALF_EXTENT;
      const dx = middleX - x;
      const dz = middleZ - z;
      if (dx * dx + dz * dz > radiusSquared) continue;
      const cell = row * EXPLORE_GRID_SIZE + column;
      const byte = cell >> 3;
      const bit = 1 << (cell & 7);
      const before = map[byte] ?? 0;
      if ((before & bit) !== 0) continue;
      map[byte] = before | bit;
      revealed += 1;
    }
  }
  return revealed;
}

/**
 * Add everything `from` has seen into `into`. Returns whether `into` gained
 * anything - a player's browser merges the server's copy into its own this
 * way, so neither ever forgets what the other already knew.
 */
export function mergeExplored(into: Uint8Array, from: Uint8Array): boolean {
  let changed = false;
  const length = Math.min(into.length, from.length);
  for (let i = 0; i < length; i++) {
    const merged = (into[i] ?? 0) | (from[i] ?? 0);
    if (merged !== into[i]) {
      into[i] = merged;
      changed = true;
    }
  }
  return changed;
}

/** How much of the world has been seen, from 0 to 1. */
export function exploredFraction(map: Uint8Array): number {
  let seen = 0;
  const total = EXPLORE_GRID_SIZE * EXPLORE_GRID_SIZE;
  for (let cell = 0; cell < total; cell++) if (isCellExplored(map, cell)) seen += 1;
  return seen / total;
}
