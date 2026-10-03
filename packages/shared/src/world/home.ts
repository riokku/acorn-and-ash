/**
 * A cabin from the outside, and the room inside it (see decision 0055).
 *
 * Outside, a cabin is a solid block with a doorway on its +Z side, the side
 * the model's front door is on: walk into the doorway, or press the interact
 * key there, and you go in. Inside is a room of its own, roomier than the
 * outside suggests, the way cozy games like to do it: the same room for every
 * cabin for now, laid out here in the room's own coordinates, with the
 * doorway on its +Z wall so you come in facing into the room.
 *
 * Plain numbers, shared by the server (which decides who goes in and out)
 * and the browser (which predicts walking about in there, and draws it).
 */

import { PLAYER_RADIUS } from '../constants';
import { box, cylinder, type Collider } from './colliders';

/** A flat point with the way something faces, in the same yaw convention as everything else. */
export interface PlacedSpot {
  readonly x: number;
  readonly z: number;
  /** Which way to face: 0 looks down -Z. */
  readonly yaw: number;
}

/** Where a cabin stands, and which way it is turned. */
export interface HomePlacement {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/* ------------------------------------------------------------------------ */
/* Outside                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * The cabin's solid block, in its own coordinates: the log walls, a little
 * past them for the log ends, and out to the chimney on the +X end. The
 * woodpile and the doorstep stay walkable.
 */
const CABIN_BLOCK = { centreX: 0.2, halfX: 2.5, halfZ: 2.05, height: 3.2 } as const;
/** The middle of the front door, along the front wall. */
const CABIN_DOOR_X = -0.575;
/** How close to the doorway you have to be to go in. */
export const DOORWAY_REACH = 1;
/**
 * How squarely you have to be walking at the door for it to count as
 * walking in, as the cosine of the angle off straight at it.
 */
export const DOORWAY_FACING_COSINE = 0.5;

/** A point in a cabin's own coordinates, turned and moved out into the world. */
function toWorld(home: HomePlacement, localX: number, localZ: number): { x: number; z: number } {
  // Three.js's own turn: local X ends up along (cos yaw, -sin yaw), local Z
  // along (sin yaw, cos yaw).
  const cos = Math.cos(home.yaw);
  const sin = Math.sin(home.yaw);
  return {
    x: home.x + localX * cos + localZ * sin,
    z: home.z - localX * sin + localZ * cos,
  };
}

/** What stops you walking through a cabin's walls. */
export function cabinCollider(home: HomePlacement): Collider {
  const centre = toWorld(home, CABIN_BLOCK.centreX, 0);
  // Collision boxes turn the other way round from Three.js models.
  return box(
    centre.x,
    CABIN_BLOCK.height / 2,
    centre.z,
    CABIN_BLOCK.halfX,
    CABIN_BLOCK.height / 2,
    CABIN_BLOCK.halfZ,
    -home.yaw,
  );
}

/**
 * The spot right in front of a cabin's door - where you stand to go in -
 * and the way into it, from there.
 */
export function cabinDoorway(home: HomePlacement): {
  readonly x: number;
  readonly z: number;
  readonly inwardX: number;
  readonly inwardZ: number;
} {
  const spot = toWorld(home, CABIN_DOOR_X, CABIN_BLOCK.halfZ + PLAYER_RADIUS + 0.1);
  return { ...spot, inwardX: -Math.sin(home.yaw), inwardZ: -Math.cos(home.yaw) };
}

/** Where you come out of a cabin: a step in front of the door, facing away from it. */
export function cabinDoorstep(home: HomePlacement): PlacedSpot {
  const spot = toWorld(home, CABIN_DOOR_X, CABIN_BLOCK.halfZ + 0.9);
  return { ...spot, yaw: home.yaw + Math.PI };
}

/**
 * Whether a player here, walking this way (a flat direction, or zero for
 * standing still) or pressing interact, is going in through this cabin's door.
 */
export function isEnteringDoorway(
  home: HomePlacement,
  x: number,
  z: number,
  walkX: number,
  walkZ: number,
  interacting: boolean,
): boolean {
  const doorway = cabinDoorway(home);
  if (Math.hypot(x - doorway.x, z - doorway.z) > DOORWAY_REACH) return false;
  if (interacting) return true;
  const length = Math.hypot(walkX, walkZ);
  if (length === 0) return false;
  return (walkX * doorway.inwardX + walkZ * doorway.inwardZ) / length >= DOORWAY_FACING_COSINE;
}

/* ------------------------------------------------------------------------ */
/* Inside                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * The room inside every cabin, in the room's own coordinates: 7 m by 6 m,
 * the doorway in the +Z wall, a little left of the middle the way the
 * cabin's own front door is.
 */
export const HOME_ROOM = {
  halfWidth: 3.5,
  halfDepth: 3,
  wallHeight: 2.7,
  wallThickness: 0.3,
  doorX: -1.1,
  doorHalfWidth: 0.55,
  /** A window in the -X wall, above the table, for daylight. */
  sideWindow: { z: 1.1, halfWidth: 0.55, bottom: 0.95, top: 1.8 },
  /** And one in the back wall, between the bed and the hearth. */
  backWindow: { x: 0.4, halfWidth: 0.55, bottom: 1.0, top: 1.8 },
} as const;

/** The furniture every room starts with, where it stands. */
export const HOME_FURNITURE = {
  /** Headboard against the back wall, along the -X wall. */
  bed: { x: -2.75, z: -1.95, halfWidth: 0.58, halfLength: 0.98, height: 0.48 },
  /** The existing chest at the foot of the bed. */
  chest: { x: -2.75, z: -0.64, halfWidth: 0.47, halfDepth: 0.25, height: 0.51 },
  /** A stone fireplace in the +X wall, under the chimney you see outside. */
  hearth: { x: 3.02, z: -0.9, halfDepth: 0.48, halfWidth: 0.9, height: 1.35 },
  /** Under the side window. */
  table: { x: -2.9, z: 1.1, halfWidth: 0.4, halfLength: 0.56, height: 0.66 },
  /** Pulled up to the table, facing it. */
  chair: { x: -2.1, z: 1.1, radius: 0.28, yaw: Math.PI / 2 },
  /** Against the +X wall, nearer the front. */
  shelf: { x: 3.33, z: 1.55, halfDepth: 0.17, halfWidth: 0.72, height: 1.9 },
  /** An oval rug in the middle of the floor. Nothing to bump into. */
  rug: { x: 0.35, z: -0.2, radiusX: 1.35, radiusZ: 0.95 },
} as const;

/** Where you appear coming in: just inside the door, facing into the room. */
export const HOME_ENTRY: PlacedSpot = { x: HOME_ROOM.doorX, z: HOME_ROOM.halfDepth - 0.65, yaw: 0 };

/** Where you wake up after a knockout, or arriving home: beside the bed, facing into the room. */
export const HOME_WAKE_SPOT: PlacedSpot = {
  x: HOME_FURNITURE.bed.x + HOME_FURNITURE.bed.halfWidth + 0.55,
  z: HOME_FURNITURE.bed.z + 0.35,
  // Facing +X, out into the room.
  yaw: -Math.PI / 2,
};

/**
 * Somewhere to sit or lie down inside (see decision 0056).
 *
 * While you use it you stay standing, as far as the rules go, at `stand`:
 * clear of everything, so getting up never leaves you inside the furniture
 * to be shoved back out. Only your drawn model moves onto the seat or the
 * mattress, to `rest`.
 */
export interface RestingPlace {
  readonly kind: 'chair' | 'bed';
  /** Where you are while you use it, and which way you face. */
  readonly stand: PlacedSpot;
  /** Where your drawn model settles, how high up, and which way it faces. */
  readonly rest: PlacedSpot & { readonly y: number };
}

/**
 * The chair, pulled up to the table and facing it. The sitting pose sits
 * back into a seat a little behind where it starts, so the model rests just
 * in front of the chair's middle; you stand beside it, on the door side.
 */
export const HOME_CHAIR: RestingPlace = {
  kind: 'chair',
  stand: {
    x: HOME_FURNITURE.chair.x,
    z: HOME_FURNITURE.chair.z + HOME_FURNITURE.chair.radius + PLAYER_RADIUS + 0.07,
    yaw: HOME_FURNITURE.chair.yaw,
  },
  rest: {
    // Facing -X, towards the table: "in front" is -X.
    x: HOME_FURNITURE.chair.x - 0.24,
    y: 0.15,
    z: HOME_FURNITURE.chair.z,
    yaw: HOME_FURNITURE.chair.yaw,
  },
};

/**
 * The bed: lying on your back on top of the quilt with your head on the
 * pillow at the headboard (-Z) end, and getting in and out on the side that
 * faces the room, where you wake up too.
 */
export const HOME_BED: RestingPlace = {
  kind: 'bed',
  stand: HOME_WAKE_SPOT,
  rest: {
    x: HOME_FURNITURE.bed.x,
    y: HOME_FURNITURE.bed.height + 0.02,
    z: HOME_FURNITURE.bed.z - HOME_FURNITURE.bed.halfLength + 0.8,
    // Facing +Z, so lying on your back puts your head towards the headboard.
    yaw: Math.PI,
  },
};

/** How far from the chair's middle, or the bed's edge, you can be and still use it. */
const RESTING_REACH = 0.85;

/** The chair or the bed, if you are close enough to either to sit or lie down. */
export function restingPlaceInReach(x: number, z: number): RestingPlace | null {
  const { chair, bed } = HOME_FURNITURE;
  if (Math.hypot(x - chair.x, z - chair.z) <= chair.radius + RESTING_REACH) return HOME_CHAIR;
  const outsideX = Math.max(0, Math.abs(x - bed.x) - bed.halfWidth);
  const outsideZ = Math.max(0, Math.abs(z - bed.z) - bed.halfLength);
  if (Math.hypot(outsideX, outsideZ) <= RESTING_REACH) return HOME_BED;
  return null;
}

/** Everything you bump into inside, in the room's own coordinates. */
export function homeRoomColliders(): Collider[] {
  const { halfWidth, halfDepth, wallHeight, wallThickness, doorX, doorHalfWidth } = HOME_ROOM;
  const outerX = halfWidth + wallThickness;
  const wall = wallThickness / 2;
  const height = wallHeight / 2;
  const doorLeft = doorX - doorHalfWidth;
  const doorRight = doorX + doorHalfWidth;
  const { bed, chest, hearth, table, chair, shelf } = HOME_FURNITURE;
  return [
    // Back, left and right walls.
    box(0, height, -halfDepth - wall, outerX, height, wall),
    box(-halfWidth - wall, height, 0, wall, height, halfDepth + wallThickness),
    box(halfWidth + wall, height, 0, wall, height, halfDepth + wallThickness),
    // The front wall either side of the doorway.
    box((-outerX + doorLeft) / 2, height, halfDepth + wall, (doorLeft + outerX) / 2, height, wall),
    box((doorRight + outerX) / 2, height, halfDepth + wall, (outerX - doorRight) / 2, height, wall),
    // The closed door itself, just outside the gap, so walking into the
    // doorway is walking into the door - which is what takes you out.
    box(doorX, height, halfDepth + wallThickness + 0.1, doorHalfWidth + 0.1, height, 0.1),
    // Furniture.
    box(bed.x, bed.height / 2, bed.z, bed.halfWidth, bed.height / 2, bed.halfLength),
    box(chest.x, chest.height / 2, chest.z, chest.halfWidth, chest.height / 2, chest.halfDepth),
    box(
      hearth.x,
      hearth.height / 2,
      hearth.z,
      hearth.halfDepth,
      hearth.height / 2,
      hearth.halfWidth,
    ),
    box(table.x, table.height / 2, table.z, table.halfWidth, table.height / 2, table.halfLength),
    cylinder(chair.x, chair.z, chair.radius, 0.9),
    box(shelf.x, shelf.height / 2, shelf.z, shelf.halfDepth, shelf.height / 2, shelf.halfWidth),
  ];
}

/** How far into the doorway you have to be, inside, for walking at it to take you out. */
const EXIT_DEPTH = HOME_ROOM.halfDepth - PLAYER_RADIUS - 0.25;

/**
 * Whether a player inside, here, walking this way or pressing interact, is
 * going out through the door.
 */
export function isLeavingRoom(
  x: number,
  z: number,
  walkX: number,
  walkZ: number,
  interacting: boolean,
): boolean {
  if (z < EXIT_DEPTH) return false;
  if (Math.abs(x - HOME_ROOM.doorX) > HOME_ROOM.doorHalfWidth + 0.15) return false;
  if (interacting) return true;
  const length = Math.hypot(walkX, walkZ);
  if (length === 0) return false;
  // Out through the door is +Z, in the room's own coordinates.
  return walkZ / length >= DOORWAY_FACING_COSINE;
}
