/**
 * Where a rowboat can float (see decision 0092).
 *
 * The lake's depth is measured in metres from the nearest shore, and its bed
 * slopes gently away from the beach: about a quarter of a metre of water a
 * metre and a half out, and over a metre three metres out. A boat needs a
 * little water under it, so these say how far from the bank is far enough,
 * and how far out is still close enough to be reached from the bank.
 */

/**
 * Every point of a moored hull is at least this far from every shore, in
 * metres: with the bed as it is, a hand's width or two of water under it, so
 * the boat floats instead of sitting on the sand.
 */
export const BOAT_HULL_MIN_DEPTH = 1.2;

/**
 * The middle of a boat built from the bank is no further out than this, in
 * metres from the shore: near enough to be stepped into from where it was
 * built, and not out in the deep water where nobody could have reached.
 */
export const BOAT_BERTH_MAX_DEPTH = 4;

/**
 * Climbing in: the middle of a boat is this close to somebody on the bank, in
 * metres. A boat moored from the bank can be 4 m out, and the water's edge is
 * a step further than where its builder stood, so this reaches the furthest
 * berth from anywhere along the beach.
 */
export const BOAT_BOARD_REACH = 4.8;

/**
 * Climbing out: the middle of the boat is no further than this from a shore,
 * in metres. Any further and the step to the beach would be a swim.
 */
export const BOAT_EXIT_MAX_DEPTH = 3;

/** Where a rider lands, in metres inland of the water's edge. */
export const BOAT_LANDING_DISTANCE = 0.7;

/**
 * A boat that has to be put ashore - its rider left the game or was knocked
 * out far from any beach - is left this far from the shore, lying along it.
 */
export const BOAT_BEACHED_DEPTH = 2.5;

/** The height of the top of the rower's seat above the water, in metres: where a rider sits. */
export const BOAT_SEAT_HEIGHT = 0.15;

/** Rowing speeds, in metres per second: steady, and pulling hard (shift). */
export const BOAT_ROW_SPEED = 3;
export const BOAT_SPRINT_SPEED = 4.2;

/** How quickly the boat picks up speed while rowing, and loses it gliding, in m/s². */
export const BOAT_ACCELERATION = 2;
export const BOAT_GLIDE_DECELERATION = 0.9;

/** How fast the bow swings round to where the rower wants to go, in radians per second. */
export const BOAT_TURN_RATE = 1.9;

/** How much of what a rowboat cost is left when it falls apart: half, rounded down for each thing. */
export const BOAT_SALVAGE_SHARE = 0.5;

/**
 * How far from the middle of a boat somebody is put when the lake freezes
 * under them (decision 0095): a step out over its side, clear of the hull.
 */
export const BOAT_ICE_STEP_OUT = 1.4;
