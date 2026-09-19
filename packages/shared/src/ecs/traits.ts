import { trait } from 'koota';

/**
 * The pieces of state an entity can have.
 *
 * The same traits are used by the server simulation inside the Durable Object
 * and by the client, so that a rule only ever has to be written once.
 */

/** Where something is, in metres. */
export const Position = trait({ x: 0, y: 0, z: 0 });

/** How fast something is moving, in metres per second. */
export const Velocity = trait({ x: 0, y: 0, z: 0 });

/** Which way a character is facing, in radians about the Y axis. */
export const Facing = trait({ yaw: 0 });

/** Whether a character's feet are on the ground. */
export const Grounded = trait({ value: true });

/** The small number this entity is known by on the wire. */
export const NetworkId = trait({ value: 0 });

/** Marks an entity that a human is driving. */
export const PlayerTag = trait();

/** The newest input the server has actually simulated for this player. */
export const LastProcessedInput = trait({ seq: 0 });

/** The camera heading the player last told us about. */
export const AimYaw = trait({ yaw: 0 });

/** A piece of scenery: a tree or a rock. */
export const Prop = trait({ kindIndex: 0, rotationY: 0, scale: 1 });

/** Marks something that never moves, so it can be skipped by movement systems. */
export const StaticTag = trait();
