/**
 * Numbers the whole game agrees on.
 *
 * Units: 1 unit = 1 metre, Y is up, time is in seconds.
 */

/** The server simulates the world at this rate. */
export const TICK_HZ = 20;
export const TICK_SECONDS = 1 / TICK_HZ;
export const TICK_MILLISECONDS = 1000 / TICK_HZ;

/** Snapshots go out every other tick, so 10 per second. */
export const SNAPSHOT_EVERY_N_TICKS = 2;
export const SNAPSHOT_HZ = TICK_HZ / SNAPSHOT_EVERY_N_TICKS;

/** Other players are drawn this far in the past so they glide instead of teleporting. */
export const INTERPOLATION_DELAY_SECONDS = 0.1;

/**
 * The client samples one input per simulation tick, then posts them in bundles.
 * Cloudflare bills incoming WebSocket messages at 20:1, so we send fewer, fatter messages.
 */
export const INPUT_SEND_HZ = 15;
export const INPUT_SEND_INTERVAL_MS = 1000 / INPUT_SEND_HZ;

/** A single connection can never make the server do unbounded work. */
export const MAX_QUEUED_INPUTS_PER_PLAYER = 40;
export const MAX_INPUTS_PER_TICK = 3;
/** Once a backlog is longer than this the server starts catching up faster. */
export const INPUT_BACKLOG_CATCHUP_THRESHOLD = 4;

/** The player capsule. */
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_EYE_HEIGHT = 1.55;

/** How the player moves. */
export const PLAYER_WALK_SPEED = 4.5;
/** Holding sprint. Phase 2 will make this cost energy; for now it is free. */
export const PLAYER_SPRINT_SPEED = 7;
export const PLAYER_ACCELERATION = 45;
export const PLAYER_DECELERATION = 30;
/**
 * How much of that acceleration is available while airborne. Full control in
 * mid-air makes a jump feel weightless; none at all makes it feel like a rail.
 */
export const PLAYER_AIR_CONTROL = 0.35;
/** How quickly the character model swings around to face where it is walking. */
export const PLAYER_TURN_RATE = 14;
/** Below this speed the character keeps the facing it already had. */
export const PLAYER_TURN_SPEED_THRESHOLD = 0.2;
/**
 * Above this horizontal speed a player is reported as sprinting. It sits halfway
 * between the two speeds, so a walker never trips it and a sprinter always does.
 */
export const SPRINT_REPORTING_SPEED = (PLAYER_WALK_SPEED + PLAYER_SPRINT_SPEED) / 2;

export const GRAVITY = -24;
export const TERMINAL_FALL_SPEED = -55;
/**
 * Upward speed at the moment of a jump. Stepped at 20 Hz under this gravity the
 * hop peaks at 1.26 m and is over in 0.65 s: springy, and nowhere near a roof.
 */
export const PLAYER_JUMP_VELOCITY = 7.2;
/** Walking off a small lip should not look like falling. */
export const GROUND_SNAP_DISTANCE = 0.3;

/** The hand-built home clearing is 64 x 64 m centred on the origin. */
export const CLEARING_SIZE = 64;
export const CLEARING_HALF = CLEARING_SIZE / 2;
/**
 * Phase 0 has no generated wilderness yet, so players are held just inside the
 * tree line instead of walking off into empty space.
 */
export const PLAYABLE_HALF_EXTENT = 38;

/**
 * How close you have to be to pick something up, measured from the player to the
 * item. Generous enough that you do not have to hunt for the exact spot.
 */
export const PICKUP_REACH = 2;

/** Where a fresh player appears, in the middle of the clearing. */
export const SPAWN_POSITION = { x: 0, y: 0, z: 6 } as const;
/** New players are spread around the spawn point so they do not stack up. */
export const SPAWN_RING_RADIUS = 2.5;

/** The world is diced into chunks for interest management. */
export const CHUNK_SIZE = 32;
/** A player is only told about entities inside this radius. */
export const INTEREST_RADIUS = 100;

/** World lifecycle. */
export const SAVE_INTERVAL_SECONDS = 30;
export const SAVE_INTERVAL_TICKS = SAVE_INTERVAL_SECONDS * TICK_HZ;
/** A tick longer than this gets logged. Durable Objects give us 30 s of CPU per event. */
export const SLOW_TICK_BUDGET_MS = 10;
export const MAX_PLAYERS_PER_WORLD = 50;

/** A 20-minute day. Night never skips in multiplayer. */
export const DAY_LENGTH_SECONDS = 20 * 60;

/** The seed the default world is built from. */
export const DEFAULT_WORLD_SEED = 0x4143_4f52;
