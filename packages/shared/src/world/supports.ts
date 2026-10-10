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

/** A support: its lowest, lowest -X, lowest -Z cube, like a cube dig, and the way the tunnel runs. Covers one metre along the tunnel and two across. */
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

/** How far across a support reaches, in half-metre cubes: two metres between the walls, room for a body to walk through. */
export const SUPPORT_SPAN = DIG_CUBE * 2;

/** How many cubes a support covers along X and along Z, for a tunnel running this way. */
function footprint(axis: SupportAxis): { readonly x: number; readonly z: number } {
  return axis === 0 ? { x: DIG_CUBE, z: SUPPORT_SPAN } : { x: SUPPORT_SPAN, z: DIG_CUBE };
}

/** Whether the whole frame is open air, floor to roof. */
function frameIsOpen(grid: DugGrid, cell: SupportCell, axis: SupportAxis): boolean {
  const size = footprint(axis);
  for (let y = 0; y < SUPPORT_HEIGHT; y++) {
    for (let dx = 0; dx < size.x; dx++) {
      for (let dz = 0; dz < size.z; dz++) {
        if (grid.isSolid(cell.ix + dx, cell.iy + y, cell.iz + dz)) return false;
      }
    }
  }
  return true;
}

/** Whether a one metre cell is open air all the way up. */
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

/** How many of the four cubes in a one metre square are solid. */
function solidInRow(grid: DugGrid, ix: number, iy: number, iz: number): number {
  let solid = 0;
  for (let dx = 0; dx < DIG_CUBE; dx++) {
    for (let dz = 0; dz < DIG_CUBE; dz++) {
      if (grid.isSolid(ix + dx, iy, iz + dz)) solid++;
    }
  }
  return solid;
}

/** How much of the floor or roof of the frame, at this height, is solid: 0 to 1. */
function layerSolidity(grid: DugGrid, cell: SupportCell, axis: SupportAxis, iy: number): number {
  const size = footprint(axis);
  let solid = 0;
  for (let dx = 0; dx < size.x; dx++) {
    for (let dz = 0; dz < size.z; dz++) {
      if (grid.isSolid(cell.ix + dx, iy, cell.iz + dz)) solid++;
    }
  }
  return solid / (size.x * size.z);
}

/** How much of a flat wall beside the frame, along its whole height, is solid: 0 to 1. */
function wallSolidity(grid: DugGrid, cell: SupportCell, axis: SupportAxis, side: -1 | 1): number {
  let solid = 0;
  for (let y = 0; y < SUPPORT_HEIGHT; y++) {
    for (let along = 0; along < DIG_CUBE; along++) {
      const dx = axis === 0 ? along : side < 0 ? -1 : SUPPORT_SPAN;
      const dz = axis === 0 ? (side < 0 ? -1 : SUPPORT_SPAN) : along;
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
export type SupportProblem = 'taken' | 'blocked' | 'tooNarrow' | 'noFloor' | 'noRoof' | 'tooWide';

/** How far along the checks a problem is: the higher, the closer the spot came to fitting. */
const PROBLEM_RANK: Record<SupportProblem, number> = {
  taken: 0,
  blocked: 1,
  tooNarrow: 1,
  noFloor: 2,
  noRoof: 3,
  tooWide: 4,
};

function closer(a: SupportProblem, b: SupportProblem): SupportProblem {
  return PROBLEM_RANK[b] > PROBLEM_RANK[a] ? b : a;
}

/** Whether two frames would stand in each other's way. */
function overlaps(cell: SupportCell, axis: SupportAxis, other: Support): boolean {
  const a = footprint(axis);
  const b = footprint(other.axis);
  return (
    cell.ix < other.ix + b.x &&
    other.ix < cell.ix + a.x &&
    cell.iz < other.iz + b.z &&
    other.iz < cell.iz + a.z &&
    cell.iy < other.iy + SUPPORT_HEIGHT &&
    other.iy < cell.iy + SUPPORT_HEIGHT
  );
}

/** What is wrong with a frame at this corner running this way, or null if it fits. */
function frameProblem(
  grid: DugGrid,
  cell: SupportCell,
  axis: SupportAxis,
  existing: readonly Support[],
): SupportProblem | null {
  if (existing.some((s) => overlaps(cell, axis, s))) return 'taken';
  if (!frameIsOpen(grid, cell, axis)) return 'blocked';
  if (layerSolidity(grid, cell, axis, cell.iy - 1) < SOLID_ENOUGH) return 'noFloor';
  if (layerSolidity(grid, cell, axis, cell.iy + SUPPORT_HEIGHT) < SOLID_ENOUGH) return 'noRoof';
  const walls = Math.min(wallSolidity(grid, cell, axis, -1), wallSolidity(grid, cell, axis, 1));
  return walls < SOLID_ENOUGH ? 'tooWide' : null;
}

/**
 * What the pointer means: the one metre cell under it (from `supportCellAt`)
 * sits somewhere along a support's two metre span, so each place the frame
 * could stand that covers it is tried. Gives where the frame goes and which way
 * it runs, or the reason the nearest try fell short.
 */
export function supportProblem(
  grid: DugGrid,
  seed: SupportCell,
  existing: readonly Support[],
):
  | { readonly axis: SupportAxis; readonly cell: SupportCell }
  | { readonly problem: SupportProblem } {
  const tries: { cell: SupportCell; axis: SupportAxis }[] = [
    { cell: seed, axis: 0 },
    { cell: { ...seed, iz: seed.iz - DIG_CUBE }, axis: 0 },
    { cell: seed, axis: 1 },
    { cell: { ...seed, ix: seed.ix - DIG_CUBE }, axis: 1 },
  ];
  let worst: SupportProblem = 'taken';
  const blocked: [number, number] = [0, 0];
  for (const attempt of tries) {
    const problem = frameProblem(grid, attempt.cell, attempt.axis, existing);
    if (problem === null) return attempt;
    if (problem === 'blocked') blocked[attempt.axis]++;
    worst = closer(worst, problem);
  }
  // Open air at the pointer but rock in every frame that would run one way: too narrow for it.
  if (blocked.some((count) => count === 2) && cellIsOpen(grid, seed)) {
    return { problem: 'tooNarrow' };
  }
  return { problem: worst };
}

/** Which way a support at exactly this corner would run, or why one cannot stand there. */
export function checkSupportCell(
  grid: DugGrid,
  cell: SupportCell,
  existing: readonly Support[],
): { readonly axis: SupportAxis } | { readonly refusal: SupportRefusal } {
  let worst: SupportProblem = 'taken';
  for (const axis of [0, 1] as const) {
    const problem = frameProblem(grid, cell, axis, existing);
    if (problem === null) return { axis };
    worst = closer(worst, problem);
  }
  return { refusal: worst === 'taken' ? 'supportTaken' : 'notTunnel' };
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
