import {
  GRAVITY,
  GROUND_SNAP_DISTANCE,
  PLAYER_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_TURN_RATE,
  PLAYER_TURN_SPEED_THRESHOLD,
  PLAYER_WALK_SPEED,
  TERMINAL_FALL_SPEED,
} from '../constants';
import { rotateToward } from '../math/angles';
import { clamp, type Vec3 } from '../math/vec3';
import { resolveCapsule, type CollisionWorld } from '../collision/capsule';

/** Buttons are a bit field so the wire format stays one byte. */
export const PlayerButton = {
  /** Reserved for Phase 2 onwards; nothing reads it yet. */
  Interact: 1 << 0,
} as const;

/**
 * One tick of intent from a player.
 *
 * `moveX` and `moveZ` are in [-1, 1] and are relative to where the camera is
 * looking: `moveZ` of 1 means "away from the camera". `yaw` is the camera's
 * heading in radians. The server never trusts these beyond those ranges.
 */
export interface PlayerInput {
  readonly seq: number;
  readonly moveX: number;
  readonly moveZ: number;
  readonly yaw: number;
  readonly buttons: number;
}

export function createInput(seq: number, moveX = 0, moveZ = 0, yaw = 0, buttons = 0): PlayerInput {
  return { seq, moveX: clamp(moveX, -1, 1), moveZ: clamp(moveZ, -1, 1), yaw, buttons };
}

/** An input that asks for nothing, used when a player's packets go missing. */
export function idleInput(seq: number, yaw: number): PlayerInput {
  return { seq, moveX: 0, moveZ: 0, yaw, buttons: 0 };
}

/** Everything about a player that movement reads and writes. */
export interface PlayerMotion {
  position: Vec3;
  velocity: Vec3;
  /** Which way the character model is facing, in radians. */
  facingYaw: number;
  grounded: boolean;
}

export function createPlayerMotion(spawn: Readonly<Vec3>, facingYaw = 0): PlayerMotion {
  return {
    position: { x: spawn.x, y: spawn.y, z: spawn.z },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw,
    grounded: true,
  };
}

/**
 * Advance one player by a fixed time step.
 *
 * The client runs this for the player it controls so they move the instant a key
 * goes down, and the server runs the very same function as the authority. That
 * is why it lives in `packages/shared` and touches nothing but its arguments.
 */
export function stepPlayer(
  motion: PlayerMotion,
  input: PlayerInput,
  deltaSeconds: number,
  world: CollisionWorld,
): void {
  const { position, velocity } = motion;

  // Turn the key presses into a direction in the world, using the camera heading.
  const moveX = clamp(input.moveX, -1, 1);
  const moveZ = clamp(input.moveZ, -1, 1);
  const inputLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
  const normalise = inputLength > 1 ? 1 / inputLength : 1;

  const sinYaw = Math.sin(input.yaw);
  const cosYaw = Math.cos(input.yaw);
  // Yaw 0 looks down -Z, which matches the camera's resting position.
  const desiredX = (-sinYaw * moveZ + cosYaw * moveX) * normalise * PLAYER_WALK_SPEED;
  const desiredZ = (-cosYaw * moveZ - sinYaw * moveX) * normalise * PLAYER_WALK_SPEED;

  const wantsToMove = inputLength > 1e-3;
  const rate = (wantsToMove ? PLAYER_ACCELERATION : PLAYER_DECELERATION) * deltaSeconds;
  // Steer the whole horizontal velocity at once. Accelerating each axis on its
  // own would make walking diagonally speed up faster than walking straight.
  const deltaX = desiredX - velocity.x;
  const deltaZ = desiredZ - velocity.z;
  const deltaLength = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  if (deltaLength <= rate) {
    velocity.x = desiredX;
    velocity.z = desiredZ;
  } else {
    const scale = rate / deltaLength;
    velocity.x += deltaX * scale;
    velocity.z += deltaZ * scale;
  }

  velocity.y = Math.max(velocity.y + GRAVITY * deltaSeconds, TERMINAL_FALL_SPEED);

  position.x += velocity.x * deltaSeconds;
  position.y += velocity.y * deltaSeconds;
  position.z += velocity.z * deltaSeconds;

  resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);

  // Settle onto the ground, including small steps down.
  const groundHeight = world.terrain.heightAt(position.x, position.z);
  if (position.y <= groundHeight + GROUND_SNAP_DISTANCE && velocity.y <= 0) {
    position.y = groundHeight;
    velocity.y = 0;
    motion.grounded = true;
  } else {
    motion.grounded = false;
  }

  // Swing the character round to face the way it is walking.
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (speed > PLAYER_TURN_SPEED_THRESHOLD) {
    const targetYaw = Math.atan2(-velocity.x, -velocity.z);
    motion.facingYaw = rotateToward(motion.facingYaw, targetYaw, PLAYER_TURN_RATE * deltaSeconds);
  }
}
