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
    if (rowIsOpen(grid, ix, iy, iz) && rowHasFloor(grid, ix, iy, iz)) return { ix, iy, iz };
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

function rowIsSolid(grid: DugGrid, ix: number, iy: number, iz: number): boolean {
  for (let dx = 0; dx < DIG_CUBE; dx++) {
    for (let dz = 0; dz < DIG_CUBE; dz++) {
      if (!grid.isSolid(ix + dx, iy, iz + dz)) return false;
    }
  }
  return true;
}

function rowHasFloor(grid: DugGrid, ix: number, iy: number, iz: number): boolean {
  return rowIsSolid(grid, ix, iy - 1, iz);
}

/** Whether every cube of a flat wall, `width` along one axis and the support's height, is solid. */
function wallIsSolid(grid: DugGrid, cell: SupportCell, axis: SupportAxis, side: -1 | 1): boolean {
  for (let y = 0; y < SUPPORT_HEIGHT; y++) {
    for (let along = 0; along < DIG_CUBE; along++) {
      const dx = axis === 0 ? along : side < 0 ? -1 : DIG_CUBE;
      const dz = axis === 0 ? (side < 0 ? -1 : DIG_CUBE) : along;
      if (!grid.isSolid(cell.ix + dx, cell.iy + y, cell.iz + dz)) return false;
    }
  }
  return true;
}

/** Which way a support in this cell would run, or why one cannot stand there. */
export function checkSupportCell(
  grid: DugGrid,
  cell: SupportCell,
  existing: readonly Support[],
): { readonly axis: SupportAxis } | { readonly refusal: SupportRefusal } {
  if (existing.some((s) => s.ix === cell.ix && s.iy === cell.iy && s.iz === cell.iz)) {
    return { refusal: 'supportTaken' };
  }
  const roofed = rowIsSolid(grid, cell.ix, cell.iy + SUPPORT_HEIGHT, cell.iz);
  if (!roofed || !rowHasFloor(grid, cell.ix, cell.iy, cell.iz) || !cellIsOpen(grid, cell)) {
    return { refusal: 'notTunnel' };
  }
  for (const axis of [0, 1] as const) {
    if (wallIsSolid(grid, cell, axis, -1) && wallIsSolid(grid, cell, axis, 1)) return { axis };
  }
  return { refusal: 'notTunnel' };
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
