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
 * Where the clearing's own ring of trees sits, regardless of how far the
 * generated wilderness beyond it reaches. Same numbers Phase 0 used
 * (`CLEARING_HALF - 4` to `CLEARING_HALF + 8`): chopping and the clearing's
 * shape do not move just because the world around it grew.
 */
export const CLEARING_TREE_LINE_INNER = CLEARING_HALF - 4;
export const CLEARING_TREE_LINE_OUTER = CLEARING_HALF + 8;
/**
 * The edge of the world: an invisible wall players are held inside, past the
 * generated wilderness. Bounded rather than infinite for now — real chunk
 * streaming is a later change.
 */
export const PLAYABLE_HALF_EXTENT = 150;

/**
 * The wilderness: generated forest and rolling ground between the clearing's
 * tree line and the wall at the edge of the world.
 */
export const WILDERNESS = {
  /** Ground stays flat out to here, through the clearing's own ring of trees. */
  flatRadius: CLEARING_TREE_LINE_OUTER + 2,
  /** Metres over which flat ground eases into hills, starting at `flatRadius`. */
  hillBlend: 18,
  /** Ground flattens again over the last stretch before the wall, so the edge of the world is never a slope. */
  edgeFlat: 20,
  /** How far a hill rises or a hollow dips at full strength. */
  hillHeight: 5,
  /** Metres per bump of terrain noise. Bigger is broader, gentler hills. */
  noiseScale: 1 / 60,
  /** Metres between candidate spots for a tree or rock, before jitter and thinning. */
  cellSize: 4,
  /** How far a candidate spot is jittered from its cell's centre, so a grid does not read as a grid. */
  jitter: 1.7,
  /** Metres per bump of the noise that decides forest from glade. */
  densityNoiseScale: 1 / 40,
  /** The sparsest and densest a patch of wilderness ever gets, as a share of candidate spots that get something. */
  densityMin: 0.08,
  densityMax: 0.62,
  /** How far scenery is scattered past the wall, so the tree line does not stop exactly on it. */
  scatterMargin: 6,
} as const;

/**
 * How close you have to be to pick something up, measured from the player to the
 * item. Generous enough that you do not have to hunt for the exact spot.
 */
export const PICKUP_REACH = 2;

/**
 * Building.
 *
 * A build always lands this far in front of the player - aim and place,
 * nothing free-form yet - close enough to feel deliberate rather than
 * flung.
 */
export const BUILD_DISTANCE = 2.6;

/**
 * Campfires.
 *
 * Atmosphere only for now - no warmth stat, no fuel cost to light one. It
 * burns down on its own; a player can also put it out early by hand.
 */
export const CAMPFIRE_BURN_SECONDS = 10 * 60;

/**
 * Chopping.
 *
 * Reach is measured to the trunk's surface rather than its middle, so a fat oak
 * is no harder to get at than a slender birch.
 */
export const CHOP_REACH = 2.2;
/** Seconds between swings. A tree of four swings takes about two seconds. */
export const SWING_INTERVAL_SECONDS = 0.45;
export const SWING_COOLDOWN_TICKS = Math.round(SWING_INTERVAL_SECONDS * TICK_HZ);
/**
 * How far off-centre a tree can be and still be hit, as the cosine of the angle
 * from where the camera is pointed. 0.5 is sixty degrees either side: you have
 * to be facing the tree, but not perfectly squared up to it.
 */
export const CHOP_FACING_COSINE = 0.5;

/**
 * Dodging.
 *
 * The other half of "readable enemy wind-ups": timed right, this is what
 * actually gets you through one, rather than only backing out of reach.
 */
/** How far one dodge moves you, in metres - a decisive step, not a stroll. */
export const DODGE_DISTANCE = 4;
/** How long a dodge leaves you untouchable, in seconds. */
export const DODGE_INVULNERABLE_SECONDS = 0.35;
/** How long before you can dodge again, in seconds. */
export const DODGE_COOLDOWN_SECONDS = 1.2;
export const DODGE_COOLDOWN_TICKS = Math.round(DODGE_COOLDOWN_SECONDS * TICK_HZ);

/**
 * A charged attack.
 *
 * The last piece of "light and charged attacks, dodge, readable enemy
 * wind-ups": held rather than tapped, and rooted to the spot for as long as
 * it takes - your own wind-up, readable the same way a threat's is. Once it
 * goes off it always finishes whatever it lands on outright, tree or
 * threat, however many swings that would otherwise have taken - the payoff
 * for standing still and committing to it.
 */
export const CHARGE_SECONDS = 1;

/**
 * Fishing.
 *
 * A cast lands as far out as the water allows, between these two distances in
 * front of you, and never so near the bank that the float looks beached.
 */
export const CAST_DISTANCE_MAX = 5;
export const CAST_DISTANCE_MIN = 1.5;
export const FLOAT_SHORE_MARGIN = 0.4;
/** Wander further than this from where you cast and the line comes in. */
export const FISHING_LEASH = 1.5;
/** How long a fish takes to bite, drawn fresh for every cast. */
export const BITE_DELAY_MIN_SECONDS = 3;
export const BITE_DELAY_MAX_SECONDS = 10;
/**
 * How long you have to click once the float goes under.
 *
 * Timed from the moment your own browser showed it, not from when the server
 * decided it, so a slow connection does not eat into it.
 */
export const BITE_WINDOW_SECONDS = 1;
/**
 * How long the server waits, after a bite, for a browser that has gone quiet.
 * Past this the fish is gone however the click turns out.
 *
 * Generous on purpose. A click can only be sent once the browser's own render
 * loop gets to run, and that loop can stall for several seconds under load
 * without the tab being anywhere near crashed: a browser test caught exactly
 * this on a busy CI runner, losing fish it had genuinely clicked on time for
 * because the five seconds this used to be ran out before the click could be
 * sent at all. This only bounds a truly silent browser; one that is merely
 * slow still gets its full second to click once it catches up.
 */
export const BITE_GIVE_UP_SECONDS = 20;
/** A breather after every cast ends, so the click that caught a fish does not cast again. */
export const CAST_COOLDOWN_SECONDS = 0.5;
/**
 * How tall the invisible wall around the water is. Well above the top of a jump,
 * so nobody hops into the pond.
 */
export const WATER_WALL_HEIGHT = 3;

/**
 * Hunger.
 *
 * Cozy-light survival: this is the only meter that runs down on its own right
 * now. Running out is a nudge to go eat, not a penalty - there is nothing
 * worse here yet, on purpose. A real consequence can come later, once there
 * is a creature or a knockout system for it to plug into.
 */
export const HUNGER_MAX = 100;
/**
 * How long a full meter takes to run out, if nothing is eaten.
 *
 * Turned right down for previews and local runs, so it can be watched rather
 * than waited out. Left alone everywhere real: twenty minutes, so it starts
 * to matter across a session without nagging.
 */
export const HUNGER_EMPTY_AFTER_SECONDS = 20 * 60;

/**
 * How much a hit from a threat can take before you are knocked out.
 *
 * Unlike hunger, running this out is a real consequence: Phase 4's first
 * creature, so it is the first meter here that is not cozy-light.
 */
export const HEALTH_MAX = 100;
/** Below this the HUD nudges the player to go eat. */
export const HUNGER_LOW_THRESHOLD = 30;
/** Below this the HUD warns you plainly: one more hit like the last one and you are down. */
export const HEALTH_LOW_THRESHOLD = 25;

/**
 * Growing back.
 *
 * Chris settled "at least thirty minutes, somewhat random"; an hour is the top
 * of that range until it has been lived with. Long enough that you walk back
 * into a clearing that healed while you were elsewhere, rather than watching it
 * happen.
 */
export const REGROW_MIN_SECONDS = 30 * 60;
/** Always twice the shortest wait, so turning one down turns both down. */
export const REGROW_MAX_SECONDS = REGROW_MIN_SECONDS * 2;
/** A tree that grows back is a new tree, and comes in at a new size. */
export const REGROWN_SCALE_MIN = 0.8;
export const REGROWN_SCALE_MAX = 1.35;
/**
 * How much room a tree wants before it will grow back. A tree appearing around
 * somebody standing on the spot would be a nasty surprise, so it waits.
 */
export const REGROW_CLEARANCE = 1.5;
/**
 * How many times one spot is counted as having grown back.
 *
 * The count is what both ends work the tree's size out from, and it travels in
 * a single byte, so this is where the counting stops. A spot at the cap still
 * grows back; every tree after it is simply the same one. At half an hour a
 * turn that is about five days of chopping the same stump without pause.
 */
export const MAX_TREE_GENERATION = 255;

/**
 * Wildlife.
 *
 * What a rabbit is - its speed, how easily it startles - lives per kind in
 * `ANIMAL_KINDS`; these are the numbers every kind shares.
 */
export const ANIMAL_TARGET_REACHED_DISTANCE = 0.4;
/**
 * How long a caught animal stays gone before it is back at its den.
 *
 * Short enough that a session never runs out of rabbits to catch, long
 * enough that emptying a den costs something. Already watchable without
 * turning it down for previews, unlike a tree's half hour.
 */
export const ANIMAL_RESPAWN_SECONDS = 60;
/** Close enough for a hunter to actually catch whatever it has been chasing. */
export const PREDATOR_CATCH_RADIUS = 1;

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
