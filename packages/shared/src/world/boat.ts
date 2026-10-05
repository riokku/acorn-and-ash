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
