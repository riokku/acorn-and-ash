import {
  GRAVITY,
  GROUND_SNAP_DISTANCE,
  PLAYER_ACCELERATION,
  PLAYER_AIR_CONTROL,
  PLAYER_DECELERATION,
  PLAYER_HEIGHT,
  PLAYER_JUMP_VELOCITY,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
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
  /** Space. Only leaves the ground if the player is standing on it. */
  Jump: 1 << 1,
  /** Shift, held. Phase 2 will make this cost energy. */
  Sprint: 1 << 2,
  /** Left mouse button. Swings whatever you are holding at whatever is in front. */
  Swing: 1 << 3,
  /**
   * Set on every input made while this browser is showing a fish on the line.
   * The first one tells the server when the player could first see the bite,
   * so the time to click is counted from there. See sim/fishing.ts.
   */
  SawBite: 1 << 4,
  /** A click wants to place whatever is aimed at right now. */
  Build: 1 << 5,
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
  const topSpeed = isHeld(input, PlayerButton.Sprint) ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  // Yaw 0 looks down -Z, which matches the camera's resting position.
  const desiredX = (-sinYaw * moveZ + cosYaw * moveX) * normalise * topSpeed;
  const desiredZ = (-cosYaw * moveZ - sinYaw * moveX) * normalise * topSpeed;

  const wantsToMove = inputLength > 1e-3;
  // Mid-air you get only a fraction of your usual grip on the world.
  const grip = motion.grounded ? 1 : PLAYER_AIR_CONTROL;
  const rate = (wantsToMove ? PLAYER_ACCELERATION : PLAYER_DECELERATION) * grip * deltaSeconds;
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

  // A jump only counts from the ground. Holding the key down in mid-air does
  // nothing, so a client cannot climb the sky by spamming it.
  if (motion.grounded && isHeld(input, PlayerButton.Jump)) {
    velocity.y = PLAYER_JUMP_VELOCITY;
    motion.grounded = false;
  }

  position.x += velocity.x * deltaSeconds;
  position.y += velocity.y * deltaSeconds;
  position.z += velocity.z * deltaSeconds;

  resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);

  // Settle onto the ground.
  const groundHeight = world.terrain.heightAt(position.x, position.z);
  const landed = position.y <= groundHeight;
  // Walking off a small lip should not look like falling, but that only applies
  // to someone who was already walking: a player coming down from a jump has to
  // reach the ground properly rather than being caught early.
  const steppedDown =
    motion.grounded && velocity.y <= 0 && position.y <= groundHeight + GROUND_SNAP_DISTANCE;

  if (landed || steppedDown) {
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

/** Is this button held down in the given input? */
export function isHeld(input: PlayerInput, button: number): boolean {
  return (input.buttons & button) !== 0;
}
