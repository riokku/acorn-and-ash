/**
 * A cabin from the outside, and the room inside it (see decision 0055).
 *
 * Outside, a cabin is a solid block with a doorway on its +Z side, the side
 * the model's front door is on: walk into the doorway, or press the interact
 * key there, and you go in. Inside is a room of its own, roomier than the
 * outside suggests, the way cozy games like to do it: sized by the kind of
 * home (`HOME_INTERIORS`), laid out here in the room's own coordinates, with
 * the doorway on its +Z wall so you come in facing into the room. Every room
 * starts empty except for its fire (see decision 0285); the bed, desk, chest
 * and garden are pieces the owner builds and places.
 *
 * Plain numbers, shared by the server (which decides who goes in and out)
 * and the browser (which predicts walking about in there, and draws it).
 */

import type { BuildableKindId } from '../data/buildables';
import {
  homeInteriorSize,
  homeOuterScale,
  isHomeKind,
  type HomeFire,
  type HomeInteriorSize,
  type HomeKind,
} from '../data/housing';
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
  readonly kind?: BuildableKindId | undefined;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/* ------------------------------------------------------------------------ */
/* Outside                                                                  */
/* ------------------------------------------------------------------------ */

/** The middle of the front door, along the front wall. */
const CABIN_DOOR_X = -0.575;

/** A home's solid block, in its own coordinates, before `homeOuterScale`. */
interface HomeBlock {
  readonly centreX: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly height: number;
}

/**
 * Each home's solid block, fitted to the model drawn for it. The woodpile,
 * the lantern and the doorstep stay walkable.
 */
const HOME_BLOCKS: Record<HomeKind, HomeBlock> = {
  // Polyfork's Camp Tent, centred on the door: about 1.05 m of canvas either
  // side of it at chest height, its full squeezed length, up to the ridge.
  tent: { centreX: CABIN_DOOR_X, halfX: 1.75, halfZ: 2.05, height: 3.3 },
  // The canvas teepee's rim, 1.83 m either side of a point a little right
  // of the door.
  teepee: { centreX: 0.2, halfX: 2.29, halfZ: 2.05, height: 3.2 },
  // Polyfork's Log Cabin, centred on the door, out to its stone footing.
  cabin: { centreX: CABIN_DOOR_X, halfX: 2.15, halfZ: 2, height: 3.2 },
  // The same cabin, drawn bigger.
  largeCabin: { centreX: CABIN_DOOR_X, halfX: 2.15, halfZ: 2, height: 3.2 },
};

/** The block for this home, as a cabin when it isn't one of the home kinds. */
function homeBlock(kind: BuildableKindId | undefined): HomeBlock {
  return HOME_BLOCKS[kind !== undefined && isHomeKind(kind) ? kind : 'cabin'];
}
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
export function cabinCollider(home: HomePlacement, groundY = 0): Collider {
  const scale = homeOuterScale(home.kind);
  const block = homeBlock(home.kind);
  const centre = toWorld(home, block.centreX * scale, 0);
  // Collision boxes turn the other way round from Three.js models.
  return box(
    centre.x,
    groundY + (block.height * scale) / 2,
    centre.z,
    block.halfX * scale,
    (block.height * scale) / 2,
    block.halfZ * scale,
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
  const scale = homeOuterScale(home.kind);
  const spot = toWorld(
    home,
    CABIN_DOOR_X * scale,
    homeBlock(home.kind).halfZ * scale + PLAYER_RADIUS + 0.1,
  );
  return { ...spot, inwardX: -Math.sin(home.yaw), inwardZ: -Math.cos(home.yaw) };
}

/** Where you come out of a cabin: a step in front of the door, facing away from it. */
export function cabinDoorstep(home: HomePlacement): PlacedSpot {
  const scale = homeOuterScale(home.kind);
  const spot = toWorld(home, CABIN_DOOR_X * scale, homeBlock(home.kind).halfZ * scale + 0.9);
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
 * What every room shares, whatever its size: the walls, the doorway's width
 * and the two windows. How big a room is, and where its door and fire are,
 * comes from `HOME_INTERIORS`.
 */
export const HOME_ROOM = {
  wallHeight: 2.7,
  wallThickness: 0.3,
  doorHalfWidth: 0.55,
  /** A window in the -X wall, for daylight. */
  sideWindow: { z: 1.1, halfWidth: 0.55, bottom: 0.95, top: 1.8 },
  /** And one in the back wall. */
  backWindow: { x: 0.4, halfWidth: 0.55, bottom: 1.0, top: 1.8 },
} as const;

export type HomeRoom = typeof HOME_ROOM & HomeInteriorSize;

/** The room inside this kind of home: its size, its door and its fire. */
export function homeRoom(kind: BuildableKindId = 'cabin'): HomeRoom {
  return { ...HOME_ROOM, ...homeInteriorSize(kind) };
}

/** The stone fireplace in a cabin's +X wall, under the chimney you see outside. */
export const HOME_FIREPLACE = { z: -0.9, halfDepth: 0.48, halfWidth: 0.9, height: 1.35 } as const;
/** The open fire ring in a tent or teepee, before its home's `fireScale`. */
export const HOME_FIRE_RING = { z: -0.4, radius: 0.36, height: 0.45 } as const;
/** How far from where you stand to cook the fire still reaches. */
const COOKING_REACH = 1.2;

export interface HomeFireLayout {
  readonly kind: HomeFire;
  /** Where the fire itself burns. */
  readonly x: number;
  readonly z: number;
  /** Where you stand to cook over it, and how far from there it reaches. */
  readonly cooking: { readonly x: number; readonly z: number; readonly reach: number };
  readonly collider: Collider;
}

/** The one thing every room comes with: its fire, open or in a fireplace. */
export function homeFire(kind: BuildableKindId = 'cabin'): HomeFireLayout {
  const room = homeInteriorSize(kind);
  if (room.fire === 'fireplace') {
    const { z, halfDepth, halfWidth, height } = HOME_FIREPLACE;
    const x = room.halfWidth - halfDepth;
    return {
      kind: 'fireplace',
      x,
      z,
      // Out in front of the hearthstones.
      cooking: { x: room.halfWidth - 1.25, z, reach: COOKING_REACH },
      collider: box(x, height / 2, z, halfDepth, height / 2, halfWidth),
    };
  }
  const { z, radius, height } = HOME_FIRE_RING;
  return {
    kind: 'campfire',
    x: 0,
    z,
    cooking: { x: 0, z, reach: COOKING_REACH },
    collider: cylinder(0, z, radius * room.fireScale, height),
  };
}

/** Where you appear coming in: just inside the door, facing into the room. */
export function homeEntry(kind: BuildableKindId = 'cabin'): PlacedSpot {
  const room = homeInteriorSize(kind);
  return { x: room.doorX, z: room.halfDepth - 0.65, yaw: 0 };
}

/**
 * Where you wake up after a knockout, or arriving home, before you have built
 * a bed: on the floor beside the fire, facing it (+X).
 */
export function homeFloorWakeSpot(kind: BuildableKindId = 'cabin'): PlacedSpot {
  const fire = homeFire(kind);
  return {
    x: fire.kind === 'fireplace' ? fire.cooking.x - 0.75 : fire.x - 1.1,
    z: fire.z,
    yaw: -Math.PI / 2,
  };
}

/* ------------------------------------------------------------------------ */
/* Furniture you build                                                      */
/* ------------------------------------------------------------------------ */

export type HomeFurnitureKind = 'bed' | 'desk' | 'storageChest' | 'indoorGarden';
export const HOME_FURNITURE_KINDS: readonly HomeFurnitureKind[] = [
  'bed',
  'desk',
  'storageChest',
  'indoorGarden',
];
export function isHomeFurniture(kind: BuildableKindId): kind is HomeFurnitureKind {
  return (HOME_FURNITURE_KINDS as readonly string[]).includes(kind);
}

/** A solid part of a piece of furniture, in the piece's own coordinates. */
export interface FurnitureBox {
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
  readonly height: number;
}

/**
 * The garden's three growing trays (Polyfork's Seedling Tray, its long side
 * front to back), this far apart along X. Both the indoor garden and the
 * campsite kitchen garden are solid to this size.
 */
export const GARDEN_TRAY = { spacing: 0.65, halfX: 0.2, halfZ: 0.3, height: 0.15 } as const;

/**
 * What each piece of built furniture is made of, before it is turned and
 * placed: what you bump into, and what has to fit inside the walls.
 */
export const HOME_FURNITURE_SHAPES: Record<HomeFurnitureKind, readonly FurnitureBox[]> = {
  // Lengthways along Z, headboard at -Z.
  bed: [{ x: 0, z: 0, halfX: 0.58, halfZ: 0.98, height: 0.48 }],
  // The table, and the chair pulled up to its +X side, facing it.
  desk: [
    { x: 0, z: 0, halfX: 0.4, halfZ: 0.56, height: 0.66 },
    { x: 0.8, z: 0, halfX: 0.22, halfZ: 0.22, height: 0.9 },
  ],
  storageChest: [{ x: 0, z: 0, halfX: 0.47, halfZ: 0.25, height: 0.51 }],
  // Three seedling trays in a row.
  indoorGarden: [-1, 0, 1].map((index) => ({
    x: index * GARDEN_TRAY.spacing,
    z: 0,
    halfX: GARDEN_TRAY.halfX,
    halfZ: GARDEN_TRAY.halfZ,
    height: GARDEN_TRAY.height,
  })),
};

/** Where the desk's chair stands, in the desk's own coordinates. */
const DESK_CHAIR = { x: 0.8, z: 0, radius: 0.28 } as const;

/** A piece placed in a room: a home decoration, or anything shaped like one. */
type PlacedPiece = HomePlacement & { readonly kind: BuildableKindId };

/**
 * What you bump into on a piece of furniture placed here, in the room's own
 * coordinates.
 */
export function furnitureColliders(piece: PlacedPiece & { kind: HomeFurnitureKind }): Collider[] {
  return HOME_FURNITURE_SHAPES[piece.kind].map((part) => {
    const at = toWorld(piece, part.x, part.z);
    return box(at.x, part.height / 2, at.z, part.halfX, part.height / 2, part.halfZ, piece.yaw);
  });
}

/** How far from a piece's middle you can be and still use it, by what it is. */
export const FURNITURE_REACH = { storageChest: 1.8, desk: 1.2, indoorGarden: 1.65 } as const;

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
 * The desk's chair, in the desk's own coordinates, pulled up to the table and
 * facing it. The sitting pose sits back into a seat a little behind where it
 * starts, so the model rests just in front of the chair's middle; you stand
 * beside it, on its +Z side.
 */
export const HOME_CHAIR: RestingPlace = {
  kind: 'chair',
  stand: {
    x: DESK_CHAIR.x,
    z: DESK_CHAIR.z + DESK_CHAIR.radius + PLAYER_RADIUS + 0.07,
    yaw: Math.PI / 2,
  },
  rest: {
    // Facing -X, towards the table: "in front" is -X.
    x: DESK_CHAIR.x - 0.24,
    y: 0.15,
    z: DESK_CHAIR.z,
    yaw: Math.PI / 2,
  },
};

const BED = HOME_FURNITURE_SHAPES.bed[0]!;

/**
 * The bed, in its own coordinates: lying on your back on top of the quilt
 * with your head on the pillow at the headboard (-Z) end, and getting in and
 * out on its +X side, where you wake up too.
 */
export const HOME_BED: RestingPlace = {
  kind: 'bed',
  // Facing +X, out into the room.
  stand: { x: BED.halfX + 0.55, z: 0.35, yaw: -Math.PI / 2 },
  rest: {
    x: 0,
    y: BED.height + 0.02,
    z: -BED.halfZ + 0.8,
    // Facing +Z, so lying on your back puts your head towards the headboard.
    yaw: Math.PI,
  },
};

/** A spot in a piece's own coordinates, out in the room. */
function placedSpot(piece: HomePlacement, spot: PlacedSpot): PlacedSpot {
  return { ...toWorld(piece, spot.x, spot.z), yaw: spot.yaw + piece.yaw };
}

/** The chair or the bed of a piece of furniture, where it stands in the room. */
export function furnitureRestingPlace(piece: PlacedPiece): RestingPlace | null {
  const place = piece.kind === 'bed' ? HOME_BED : piece.kind === 'desk' ? HOME_CHAIR : null;
  if (place === null) return null;
  return {
    kind: place.kind,
    stand: placedSpot(piece, place.stand),
    rest: { ...placedSpot(piece, place.rest), y: place.rest.y },
  };
}

/** How far from the chair's middle, or the bed's edge, you can be and still use it. */
const RESTING_REACH = 0.85;

/** How far a spot in the room is from a piece's chair, or from the edge of its bed. */
function restingDistance(piece: PlacedPiece, x: number, z: number): number | null {
  // Into the piece's own coordinates: `toWorld` backwards.
  const cos = Math.cos(piece.yaw),
    sin = Math.sin(piece.yaw),
    dx = x - piece.x,
    dz = z - piece.z;
  const localX = dx * cos - dz * sin,
    localZ = dx * sin + dz * cos;
  if (piece.kind === 'desk')
    return Math.hypot(localX - DESK_CHAIR.x, localZ - DESK_CHAIR.z) - DESK_CHAIR.radius;
  if (piece.kind !== 'bed') return null;
  return Math.hypot(
    Math.max(0, Math.abs(localX - BED.x) - BED.halfX),
    Math.max(0, Math.abs(localZ - BED.z) - BED.halfZ),
  );
}

/** The nearest chair or bed you are close enough to sit or lie down on, if any. */
export function restingPlaceInReach(
  x: number,
  z: number,
  pieces: readonly PlacedPiece[],
): RestingPlace | null {
  let nearest: RestingPlace | null = null,
    best = RESTING_REACH;
  for (const piece of pieces) {
    const distance = restingDistance(piece, x, z);
    if (distance === null || distance > best) continue;
    nearest = furnitureRestingPlace(piece);
    best = distance;
  }
  return nearest;
}

/**
 * The chair or bed someone using one is at: the one of that kind whose
 * standing spot is nearest where they are.
 */
export function restingPlaceAt(
  kind: RestingPlace['kind'],
  x: number,
  z: number,
  pieces: readonly PlacedPiece[],
): RestingPlace | null {
  let nearest: RestingPlace | null = null,
    best = Infinity;
  for (const piece of pieces) {
    const place = furnitureRestingPlace(piece);
    if (place === null || place.kind !== kind) continue;
    const distance = Math.hypot(place.stand.x - x, place.stand.z - z);
    if (distance < best) {
      nearest = place;
      best = distance;
    }
  }
  return nearest;
}

/**
 * Where you wake up at home: getting out of your bed, if you have built one,
 * or else on the floor by the fire.
 */
export function homeWakeSpot(
  kind: BuildableKindId,
  pieces: readonly PlacedPiece[],
): { readonly spot: PlacedSpot; readonly fromBed: boolean } {
  const bed = pieces.find((piece) => piece.kind === 'bed');
  const place = bed === undefined ? null : furnitureRestingPlace(bed);
  return place === null
    ? { spot: homeFloorWakeSpot(kind), fromBed: false }
    : { spot: place.stand, fromBed: true };
}

/** The first piece of this kind in a home, and how far from its middle you can use it. */
export function furnitureSpot(
  kind: keyof typeof FURNITURE_REACH,
  pieces: readonly PlacedPiece[],
): { readonly x: number; readonly z: number; readonly reach: number } | null {
  const piece = pieces.find((other) => other.kind === kind);
  return piece === undefined ? null : { x: piece.x, z: piece.z, reach: FURNITURE_REACH[kind] };
}

/** The walls and the fire: everything you bump into in an empty room. */
export function homeRoomColliders(kind: BuildableKindId = 'cabin'): Collider[] {
  const { halfWidth, halfDepth, wallHeight, wallThickness, doorX, doorHalfWidth } = homeRoom(kind);
  const outerX = halfWidth + wallThickness;
  const wall = wallThickness / 2;
  const height = wallHeight / 2;
  const doorLeft = doorX - doorHalfWidth;
  const doorRight = doorX + doorHalfWidth;
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
    homeFire(kind).collider,
  ];
}

/** How far out from the middle a room's collision has to reach, walls and all. */
export function homeRoomReach(kind: BuildableKindId = 'cabin'): number {
  const room = homeRoom(kind);
  return Math.max(room.halfWidth, room.halfDepth) + room.wallThickness;
}

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
  kind: HomeKind = 'cabin',
): boolean {
  const room = homeInteriorSize(kind);
  // How far into the doorway you have to be, inside, for walking at it to take you out.
  if (z < room.halfDepth - PLAYER_RADIUS - 0.25) return false;
  if (Math.abs(x - room.doorX) > HOME_ROOM.doorHalfWidth + 0.15) return false;
  if (interacting) return true;
  const length = Math.hypot(walkX, walkZ);
  if (length === 0) return false;
  // Out through the door is +Z, in the room's own coordinates.
  return walkZ / length >= DOORWAY_FACING_COSINE;
}
