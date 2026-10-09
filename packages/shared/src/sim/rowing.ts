/**
 * Rowing a boat across the lake (see decision 0093).
 *
 * The rider is the boat: while somebody is aboard, their position is the
 * middle of the hull and their facing is the way the bow points, so every
 * rule about where a player is - the snapshots, the map, the camera - works
 * for a boat with nothing added. This file is the whole of what a boat does
 * differently, and the browser runs it for the player it controls the same
 * way the server does, like walking (`stepPlayer`).
 */

import { rotateToward, angleDelta } from '../math/angles';
import { clamp, type Vec3 } from '../math/vec3';
import { type CollisionWorld } from '../collision/capsule';
import { BUILDABLE_KINDS } from '../data/buildables';
import type { ItemId } from '../data/items';
import {
  BOAT_ACCELERATION,
  BOAT_BEACHED_DEPTH,
  BOAT_BOARD_REACH,
  BOAT_EXIT_MAX_DEPTH,
  BOAT_GLIDE_DECELERATION,
  BOAT_HULL_MIN_DEPTH,
  BOAT_LANDING_DISTANCE,
  BOAT_ROW_SPEED,
  BOAT_SALVAGE_SHARE,
  BOAT_SPRINT_SPEED,
  BOAT_TURN_RATE,
} from '../world/boat';
import { LAKE, nearestShoreIsIsland, type LakeSlope } from '../world/lake';
import { navigableWaterSlopeAt, navigableWaterSurfaceAt } from '../world/navigable-water';
import { STREAM, streamCurrentAt } from '../world/stream';
import {
  isHeld,
  PlayerButton,
  worldMoveDirection,
  type PlayerInput,
  type PlayerMotion,
} from './player';

/** Where a boat sits in the world: its middle, and the turn of its model (see `BuiltProp.yaw`). */
export interface BoatPlace {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** How a boat's model is turned when its bow points the way a character facing `facingYaw` looks. */
export function boatYawFor(facingYaw: number): number {
  return facingYaw + Math.PI / 2;
}

/** The way a rider faces, when the boat is turned `boatYaw`: out over the bow. */
export function riderFacingFor(boatYaw: number): number {
  return boatYaw - Math.PI / 2;
}

const rowboat = BUILDABLE_KINDS.rowboat;
const HULL_HALF_LENGTH = rowboat.footprintHalfLength;
const HULL_RADIUS = rowboat.footprintRadius;

/** Reused so checking the hull makes no garbage; nothing here is kept between calls. */
const slope: LakeSlope = { depth: 0, towardX: 0, towardZ: 0 };

/** Nothing below this speed counts as moving, so a boat that has all but stopped stops. */
const DRIFT_STOPS_BELOW = 0.02;

/**
 * Keep the hull afloat: every point of it - the middle and the two ends of
 * its length, each with eight round its edge, the same points a mooring is
 * checked at - at least `BOAT_HULL_MIN_DEPTH` from every shore. Whichever
 * point is furthest into the shallows pushes the whole boat back out, along
 * the way the water gets deeper there. Returns the way it was pushed (a
 * direction pointing out to deeper water) or null when it was already afloat.
 */
export function keepBoatAfloat(
  position: Vec3,
  boatYaw: number,
  pushed: { x: number; z: number } = { x: 0, z: 0 },
): { x: number; z: number } | null {
  const alongX = Math.cos(boatYaw) * HULL_HALF_LENGTH;
  const alongZ = -Math.sin(boatYaw) * HULL_HALF_LENGTH;
  let moved = false;
  for (let pass = 0; pass < 4; pass++) {
    let shortest = 0;
    let outX = 0;
    let outZ = 0;
    for (let end = -1; end <= 1; end++) {
      const middleX = position.x + alongX * end;
      const middleZ = position.z + alongZ * end;
      for (let side = -1; side < 8; side++) {
        // -1 is the middle itself, 0 to 7 are the points round it.
        const angle = (Math.max(side, 0) * Math.PI) / 4;
        const reach = side < 0 ? 0 : HULL_RADIUS;
        navigableWaterSlopeAt(
          middleX + Math.cos(angle) * reach,
          middleZ + Math.sin(angle) * reach,
          slope,
        );
        const short = BOAT_HULL_MIN_DEPTH - slope.depth;
        if (short > shortest) {
          shortest = short;
          outX = slope.towardX;
          outZ = slope.towardZ;
        }
      }
    }
    if (shortest <= 0.001) break;
    position.x += outX * shortest;
    position.z += outZ * shortest;
    pushed.x = outX;
    pushed.z = outZ;
    moved = true;
  }
  return moved ? pushed : null;
}

/** How wide a turn the bow can still be rowed through at full strength; wider ones go slower. */
const FULL_SPEED_WITHIN = 0.4;

/**
 * One tick of rowing.
 *
 * The bow swings round toward wherever the rower is pointing (relative to the
 * camera, like walking), and the boat only picks up speed as it comes round,
 * so a sharp turn is a slow one. Let go and it glides to a stop. The hull is
 * kept afloat (see `keepBoatAfloat`) and slides along the bank instead of
 * running aground. The rider, and so the boat, rides on the surface.
 */
export function stepBoat(
  motion: PlayerMotion,
  input: PlayerInput,
  deltaSeconds: number,
  world: CollisionWorld,
): void {
  const { position, velocity } = motion;
  const direction = worldMoveDirection(
    clamp(input.moveX, -1, 1),
    clamp(input.moveZ, -1, 1),
    input.yaw,
  );
  const wantsToMove = direction.x !== 0 || direction.z !== 0;

  let desiredX = 0;
  let desiredZ = 0;
  if (wantsToMove) {
    const wanted = Math.atan2(-direction.x, -direction.z);
    motion.facingYaw = rotateToward(motion.facingYaw, wanted, BOAT_TURN_RATE * deltaSeconds);
    const off = Math.abs(angleDelta(motion.facingYaw, wanted));
    const alignment = clamp(1 - Math.max(0, off - FULL_SPEED_WITHIN) / (Math.PI / 2), 0, 1);
    const top = isHeld(input, PlayerButton.Sprint) ? BOAT_SPRINT_SPEED : BOAT_ROW_SPEED;
    desiredX = -Math.sin(motion.facingYaw) * top * alignment;
    desiredZ = -Math.cos(motion.facingYaw) * top * alignment;
  }

  const rate = (wantsToMove ? BOAT_ACCELERATION : BOAT_GLIDE_DECELERATION) * deltaSeconds;
  const deltaX = desiredX - velocity.x;
  const deltaZ = desiredZ - velocity.z;
  const deltaLength = Math.hypot(deltaX, deltaZ);
  if (deltaLength <= rate) {
    velocity.x = desiredX;
    velocity.z = desiredZ;
  } else {
    velocity.x += (deltaX / deltaLength) * rate;
    velocity.z += (deltaZ / deltaLength) * rate;
  }
  if (!wantsToMove && Math.hypot(velocity.x, velocity.z) < DRIFT_STOPS_BELOW) {
    velocity.x = 0;
    velocity.z = 0;
  }
  velocity.y = 0;

  const current = streamCurrentAt(STREAM, position.x, position.z);
  position.x += (velocity.x + current.x) * deltaSeconds;
  position.z += (velocity.z + current.z) * deltaSeconds;

  const shoreward = keepBoatAfloat(position, boatYawFor(motion.facingYaw));
  if (shoreward !== null) {
    // Running into the bank takes the speed out of the push into it, and no more.
    const into = velocity.x * shoreward.x + velocity.z * shoreward.z;
    if (into < 0) {
      velocity.x -= into * shoreward.x;
      velocity.z -= into * shoreward.z;
    }
  }

  const limit = world.boundsHalfExtent;
  position.x = clamp(position.x, -limit, limit);
  position.z = clamp(position.z, -limit, limit);
  position.y = navigableWaterSurfaceAt(position.x, position.z);
  motion.grounded = true;
}

/**
 * Whether somebody standing here is near enough the middle of a boat to climb
 * into it. Measured in the flat, like every reach.
 */
export function isWithinBoardingReach(position: Readonly<Vec3>, boat: BoatPlace): boolean {
  return Math.hypot(position.x - boat.x, position.z - boat.z) <= BOAT_BOARD_REACH;
}

/** A spot on dry land, and which way is the water from it. */
export interface Landing {
  readonly x: number;
  readonly z: number;
  /** A direction, length one, pointing out over the water. */
  readonly towardX: number;
  readonly towardZ: number;
  /** How far from the shore the boat's middle was. */
  readonly depth: number;
  /** Whether that shore is an island's, so the bank here is not one you can walk home from. */
  readonly onIsland: boolean;
}

/**
 * Where somebody climbing out of a boat here steps ashore: on the bank, just
 * inland of the nearest shore. Null when the boat is too far out for that.
 */
export function landingFrom(x: number, z: number): Landing | null {
  navigableWaterSlopeAt(x, z, slope);
  if (slope.depth > BOAT_EXIT_MAX_DEPTH) return null;
  return landingBeside(x, z);
}

/** The same landing, however far out the boat is: where it would be put ashore from. */
export function landingBeside(x: number, z: number): Landing {
  navigableWaterSlopeAt(x, z, slope);
  const { depth, towardX, towardZ } = slope;
  const inland = depth + BOAT_LANDING_DISTANCE;
  return {
    x: x - towardX * inland,
    z: z - towardZ * inland,
    towardX,
    towardZ,
    depth,
    onIsland: nearestShoreIsIsland(LAKE, x, z),
  };
}

/**
 * Put a boat ashore: moved in beside the nearest shore, lying along it, the
 * way it would be moored from the bank. For a boat whose rider has gone
 * somewhere it cannot follow.
 */
export function beachedBoat(x: number, z: number): BoatPlace {
  navigableWaterSlopeAt(x, z, slope);
  const { depth, towardX, towardZ } = slope;
  const shoreX = x - towardX * depth;
  const shoreZ = z - towardZ * depth;
  // The hull runs along the bank, which is the way at right angles to the water.
  const alongX = -towardZ;
  const alongZ = towardX;
  return {
    x: shoreX + towardX * BOAT_BEACHED_DEPTH,
    z: shoreZ + towardZ * BOAT_BEACHED_DEPTH,
    yaw: Math.atan2(-alongZ, alongX),
  };
}

/** What is left of a rowboat that comes apart: these many of each thing it was built from. */
export interface BoatSalvage {
  readonly item: ItemId;
  readonly count: number;
}

/**
 * The pile a boat falls apart into (see decision 0094): about half of what
 * it cost, rounded down, so losing one costs a little and rebuilding is
 * still a trip to the woods and the reeds.
 */
export function boatSalvage(): BoatSalvage[] {
  const pile: BoatSalvage[] = [];
  for (const cost of rowboat.costs) {
    const count = Math.floor(cost.amount * BOAT_SALVAGE_SHARE);
    if (count > 0) pile.push({ item: cost.item, count });
  }
  return pile;
}

/** Drift an unattended floating hull through the same current used by rowers. */
export function driftBoat(
  boat: { x: number; z: number; yaw: number },
  deltaSeconds: number,
): boolean {
  const current = streamCurrentAt(STREAM, boat.x, boat.z);
  if (current.x === 0 && current.z === 0) return false;
  const position = {
    x: boat.x + current.x * deltaSeconds,
    y: 0,
    z: boat.z + current.z * deltaSeconds,
  };
  keepBoatAfloat(position, boat.yaw);
  const moved = Math.hypot(position.x - boat.x, position.z - boat.z) > 0.00001;
  boat.x = position.x;
  boat.z = position.z;
  return moved;
}
