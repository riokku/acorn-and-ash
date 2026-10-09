/**
 * Mine supports (decision 0119).
 *
 * A support is two wooden posts and a cross beam, standing in a tunnel a metre
 * wide: the posts against the two walls, the beam under the roof. It fills one
 * whole-metre cell of tunnel, two metres tall, and is kept apart from the dug
 * ground the same way digs are: a short list of small numbers that the server
 * saves and every browser replays.
 *
 * A support only stands where it would really hold something up: open air in
 * its cell, solid floor under it, solid roof over it, and solid ground along
 * both walls. Which way it runs is worked out from the walls, not chosen.
 */

import { DIG_CUBE, VOXEL, voxelIndex, type DugGrid } from './digging';

/** How tall a support is, in half-metre cubes: the two metres a player stands in. */
export const SUPPORT_HEIGHT = 4;

/** Which way the tunnel runs through a support: along X (posts either side in Z), or along Z. */
export type SupportAxis = 0 | 1;

/** A support: its lowest, lowest -X, lowest -Z cube, like a cube dig, and the way the tunnel runs. */
export interface Support {
  readonly ix: number;
  readonly iy: number;
  readonly iz: number;
  readonly axis: SupportAxis;
}

/** The cell a support would stand in, before anybody works out which way it runs. */
export interface SupportCell {
  readonly ix: number;
  readonly iy: number;
  readonly iz: number;
}

/** Why a support cannot stand in a cell. */
export type SupportRefusal = 'notTunnel' | 'supportTaken';

/** Most supports a world will ever hold: bounds the save and the join message. */
export const SUPPORT_MAX_COUNT = 4000;

/**
 * The cell a pointer on a floor, wall or roof means: the whole-metre square
 * beside or above the point, standing on the nearest floor below it. Null if
 * there is no floor within a few metres.
 */
export function supportCellAt(
  grid: DugGrid,
  point: { readonly x: number; readonly y: number; readonly z: number },
  normal: { readonly x: number; readonly y: number; readonly z: number },
): SupportCell | null {
  // A quarter metre off the surface, into the open air in front of it.
  const x = point.x + normal.x * 0.25;
  const z = point.z + normal.z * 0.25;
  const ix = Math.floor(x) * DIG_CUBE;
  const iz = Math.floor(z) * DIG_CUBE;
  const top = voxelIndex(point.y + normal.y * 0.25 + 0.05);
  // The floor is the first open cube with solid ground under it, going down.
  for (let iy = top; iy > top - 12; iy--) {
    if (rowIsOpen(grid, ix, iy, iz) && solidInRow(grid, ix, iy - 1, iz) === DIG_CUBE * DIG_CUBE)
      return { ix, iy, iz };
  }
  return null;
}

/** Whether the cell is open air all the way up. */
function cellIsOpen(grid: DugGrid, cell: SupportCell): boolean {
  for (let y = 0; y < SUPPORT_HEIGHT; y++) {
    for (let dx = 0; dx < DIG_CUBE; dx++) {
      for (let dz = 0; dz < DIG_CUBE; dz++) {
        if (grid.isSolid(cell.ix + dx, cell.iy + y, cell.iz + dz)) return false;
      }
    }
  }
  return true;
}

function rowIsOpen(grid: DugGrid, ix: number, iy: number, iz: number): boolean {
  for (let dx = 0; dx < DIG_CUBE; dx++) {
    for (let dz = 0; dz < DIG_CUBE; dz++) {
      if (grid.isSolid(ix + dx, iy, iz + dz)) return false;
    }
  }
  return true;
}

/** How many of the four cubes in a row are solid. */
function solidInRow(grid: DugGrid, ix: number, iy: number, iz: number): number {
  let solid = 0;
  for (let dx = 0; dx < DIG_CUBE; dx++) {
    for (let dz = 0; dz < DIG_CUBE; dz++) {
      if (grid.isSolid(ix + dx, iy, iz + dz)) solid++;
    }
  }
  return solid;
}

/** How much of a flat wall beside the cell, along its whole height, is solid: 0 to 1. */
function wallSolidity(grid: DugGrid, cell: SupportCell, axis: SupportAxis, side: -1 | 1): number {
  let solid = 0;
  for (let y = 0; y < SUPPORT_HEIGHT; y++) {
    for (let along = 0; along < DIG_CUBE; along++) {
      const dx = axis === 0 ? along : side < 0 ? -1 : DIG_CUBE;
      const dz = axis === 0 ? (side < 0 ? -1 : DIG_CUBE) : along;
      if (grid.isSolid(cell.ix + dx, cell.iy + y, cell.iz + dz)) solid++;
    }
  }
  return solid / (SUPPORT_HEIGHT * DIG_CUBE);
}

/**
 * A little slack is allowed in the ground around a support: three quarters of
 * the roof, floor and each wall must be solid, so a tunnel with a ragged edge or
 * a half-metre step in it still takes one.
 */
const SOLID_ENOUGH = 0.75;

/** Why a cell cannot take a support, in the order a player would want to hear it. */
export type SupportProblem = 'taken' | 'blocked' | 'noFloor' | 'noRoof' | 'tooWide';

/** What is wrong with this cell, or which way a support would run if nothing is. */
export function supportProblem(
  grid: DugGrid,
  cell: SupportCell,
  existing: readonly Support[],
): { readonly axis: SupportAxis } | { readonly problem: SupportProblem } {
  if (existing.some((s) => s.ix === cell.ix && s.iy === cell.iy && s.iz === cell.iz)) {
    return { problem: 'taken' };
  }
  if (!cellIsOpen(grid, cell)) return { problem: 'blocked' };
  const row = DIG_CUBE * DIG_CUBE;
  if (solidInRow(grid, cell.ix, cell.iy - 1, cell.iz) / row < SOLID_ENOUGH) {
    return { problem: 'noFloor' };
  }
  if (solidInRow(grid, cell.ix, cell.iy + SUPPORT_HEIGHT, cell.iz) / row < SOLID_ENOUGH) {
    return { problem: 'noRoof' };
  }
  let best: SupportAxis | null = null;
  let bestScore = 0;
  for (const axis of [0, 1] as const) {
    const score = Math.min(wallSolidity(grid, cell, axis, -1), wallSolidity(grid, cell, axis, 1));
    if (score >= SOLID_ENOUGH && score > bestScore) {
      best = axis;
      bestScore = score;
    }
  }
  return best === null ? { problem: 'tooWide' } : { axis: best };
}

/** Which way a support in this cell would run, or why one cannot stand there. */
export function checkSupportCell(
  grid: DugGrid,
  cell: SupportCell,
  existing: readonly Support[],
): { readonly axis: SupportAxis } | { readonly refusal: SupportRefusal } {
  const result = supportProblem(grid, cell, existing);
  if ('axis' in result) return result;
  return { refusal: result.problem === 'taken' ? 'supportTaken' : 'notTunnel' };
}

/** Where a support's middle is, in metres, for working out reach. */
export function supportMiddle(cell: SupportCell): { x: number; y: number; z: number } {
  return {
    x: (cell.ix + DIG_CUBE / 2) * VOXEL,
    y: (cell.iy + SUPPORT_HEIGHT / 2) * VOXEL,
    z: (cell.iz + DIG_CUBE / 2) * VOXEL,
  };
}

/** Whether a body with its feet here is near enough to a cell to stand a support in it. */
export function supportInReach(
  feet: { readonly x: number; readonly y: number; readonly z: number },
  cell: SupportCell,
  reach: number,
): boolean {
  const middle = supportMiddle(cell);
  return Math.hypot(middle.x - feet.x, middle.y - feet.y, middle.z - feet.z) <= reach;
}
