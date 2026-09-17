/**
 * Which worlds exist.
 *
 * Phase 0 has exactly one. Phase 1 puts the list in D1 and lets a player pick,
 * so this is the seam that will grow.
 */
export const DEFAULT_WORLD_ID = 'home-clearing';

const WORLD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,40}$/;

/**
 * A world id becomes a Durable Object name, so it is checked before use. Without
 * this, anybody could create endless worlds just by guessing URLs.
 */
export function isValidWorldId(worldId: string): boolean {
  return WORLD_ID_PATTERN.test(worldId);
}
