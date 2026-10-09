import type * as THREE from 'three/webgpu';

import { loadNamedGeometries } from './model-loading';

import dugWallKitUrl from '@assets/terrain/dug-wall-kit.glb?url';

/**
 * The smooth lining of dug tunnels and pits (decision 0114, step 5).
 *
 * Three pieces made in Blender (tools/art/dug_wall_kit.py), each one half-metre
 * cell big: a flat wall, a quarter-round edge, and a round dome for the corner
 * of a dead end. Every open half-metre cube of a hole next to solid ground gets
 * whichever piece fits the sides that are solid, turned to face the right way.
 * One metre-wide tunnel is four edge pieces round, so its cross-section is a
 * circle; a dead end is a dome. The code here only chooses, turns and copies
 * the pieces: none of the shapes are drawn in code.
 *
 * In the pieces' own coordinates the cell runs 0 to 0.5 on each axis, Y is up,
 * and the solid sides are the low ones (x = 0, y = 0, z = 0).
 */

export type WallPieceName = 'dug_panel' | 'dug_edge' | 'dug_dome';

/** For each axis (x, y, z): whether the neighbour on its low side, and on its high side, is solid. */
export type ClosedSides = readonly [
  readonly [boolean, boolean],
  readonly [boolean, boolean],
  readonly [boolean, boolean],
];

/** Where one copy of a piece goes: which of its axes become which of the cell's, and which are mirrored. */
export interface WallPiecePlan {
  readonly piece: WallPieceName;
  /** `canon[m]` is the piece's own axis that becomes the cell's axis `actual[m]`. */
  readonly canon: readonly [number, number, number];
  readonly actual: readonly [number, number, number];
  /** Whether that axis runs backwards (the solid side is the cell's high side). */
  readonly flips: readonly [boolean, boolean, boolean];
}

const AXES = [0, 1, 2] as const;

/** The pieces that line one open cube, given which of its sides touch solid ground. */
export function planWallPieces(closed: ClosedSides): WallPiecePlan[] {
  const bothSides = AXES.filter((axis) => closed[axis][0] && closed[axis][1]);
  if (bothSides.length > 0) {
    // A slot half a metre across has no room to round: a flat wall on each solid side.
    const plans: WallPiecePlan[] = [];
    for (const axis of AXES) {
      for (const low of [true, false]) {
        if (!closed[axis][low ? 0 : 1]) continue;
        const [a, b] = AXES.filter((other) => other !== axis);
        plans.push({
          piece: 'dug_panel',
          canon: [1, 0, 2],
          actual: [axis, a!, b!],
          flips: [!low, false, false],
        });
      }
    }
    return plans;
  }
  const single = AXES.filter((axis) => closed[axis][0] !== closed[axis][1]).map((axis) => ({
    axis,
    low: closed[axis][0],
  }));
  const free = AXES.filter((axis) => !single.some((side) => side.axis === axis));
  const [s1, s2, s3] = single;
  if (s1 === undefined) return [];
  if (s2 === undefined) {
    return [
      {
        piece: 'dug_panel',
        canon: [1, 0, 2],
        actual: [s1.axis, free[0]!, free[1]!],
        flips: [!s1.low, false, false],
      },
    ];
  }
  if (s3 === undefined) {
    return [
      {
        piece: 'dug_edge',
        canon: [1, 2, 0],
        actual: [s1.axis, s2.axis, free[0]!],
        flips: [!s1.low, !s2.low, false],
      },
    ];
  }
  return [
    {
      piece: 'dug_dome',
      canon: [1, 2, 0],
      actual: [s1.axis, s2.axis, s3.axis],
      flips: [!s1.low, !s2.low, !s3.low],
    },
  ];
}

/** Metres along one side of a cell. */
export const WALL_CELL = 0.5;

/** Whether turning a piece this way flips it inside out, so its triangles must be wound the other way. */
export function plansMirror(plan: WallPiecePlan): boolean {
  const mapping: number[] = [0, 0, 0];
  const flipped: boolean[] = [false, false, false];
  for (let m = 0; m < 3; m++) {
    mapping[plan.canon[m]!] = plan.actual[m]!;
    flipped[plan.canon[m]!] = plan.flips[m]!;
  }
  let swaps = 0;
  const seen = [false, false, false];
  for (let start = 0; start < 3; start++) {
    if (seen[start]) continue;
    let length = 0;
    for (let at = start; !seen[at]; at = mapping[at]!) {
      seen[at] = true;
      length++;
    }
    swaps += length - 1;
  }
  const flips = flipped.filter(Boolean).length;
  return (swaps + flips) % 2 === 1;
}

/** Where a point of a piece ends up, in the cell's own coordinates. */
export function turnPoint(
  plan: WallPiecePlan,
  x: number,
  y: number,
  z: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const q = [x, y, z];
  for (let m = 0; m < 3; m++) {
    const value = q[plan.canon[m]!]!;
    out[plan.actual[m]!] = plan.flips[m]! ? WALL_CELL - value : value;
  }
  return out;
}

/** Where a direction of a piece ends up (no shifting, only turning and mirroring). */
function turnDirection(
  plan: WallPiecePlan,
  x: number,
  y: number,
  z: number,
  out: [number, number, number],
): [number, number, number] {
  const q = [x, y, z];
  for (let m = 0; m < 3; m++) {
    const value = q[plan.canon[m]!]!;
    out[plan.actual[m]!] = plan.flips[m]! ? -value : value;
  }
  return out;
}

export interface WallKit {
  readonly pieces: ReadonlyMap<string, THREE.BufferGeometry>;
}

let kit: WallKit | null = null;
let preloadPromise: Promise<void> | null = null;

/** Fetch the kit. Resolves at once if already loaded. */
export function preloadDugWalls(): Promise<void> {
  preloadPromise ??= loadNamedGeometries(dugWallKitUrl).then((pieces) => {
    kit = { pieces };
  });
  return preloadPromise;
}

/** The loaded kit, or null while it is still on its way. */
export function dugWallKit(): WallKit | null {
  return kit;
}

/** The pieces' mesh data a chunk is being built from. */
export interface WallMeshBuffers {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly colors: number[];
  readonly indices: number[];
}

/**
 * Copy one turned piece into the buffers, at the cell whose low corner is
 * (originX, originY, originZ) metres. `texture` gives each point's picture
 * coordinates from where it landed and which way it faces.
 */
export function appendWallPiece(
  geometry: THREE.BufferGeometry,
  plan: WallPiecePlan,
  origin: readonly [number, number, number],
  into: WallMeshBuffers,
  texture: (
    x: number,
    y: number,
    z: number,
    normalY: number,
    out: [number, number],
  ) => [number, number],
): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  if (index === null) throw new Error('wall piece has no index');
  const base = into.positions.length / 3;
  const point: [number, number, number] = [0, 0, 0];
  const direction: [number, number, number] = [0, 0, 0];
  const uv: [number, number] = [0, 0];
  for (let i = 0; i < position.count; i++) {
    turnPoint(plan, position.getX(i), position.getY(i), position.getZ(i), point);
    turnDirection(plan, normal.getX(i), normal.getY(i), normal.getZ(i), direction);
    const x = origin[0] + point[0];
    const y = origin[1] + point[1];
    const z = origin[2] + point[2];
    into.positions.push(x, y, z);
    into.normals.push(direction[0], direction[1], direction[2]);
    into.colors.push(1, 1, 1);
    texture(x, y, z, direction[1], uv);
    into.uvs.push(uv[0], uv[1]);
  }
  const mirrored = plansMirror(plan);
  for (let i = 0; i < index.count; i += 3) {
    const a = base + index.getX(i);
    const b = base + index.getX(i + 1);
    const c = base + index.getX(i + 2);
    if (mirrored) into.indices.push(a, c, b);
    else into.indices.push(a, b, c);
  }
}
