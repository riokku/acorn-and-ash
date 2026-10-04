/**
 * What a world knows a player by.
 *
 * The same shape the game server accepts (`PLAYER_KEY_PATTERN` in its
 * `world.ts`): it checks every key it is handed, whoever hands it over.
 */
const PLAYER_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isPlayerKey(value: unknown): value is string {
  return typeof value === 'string' && PLAYER_KEY_PATTERN.test(value);
}

/** A fresh, unguessable key: 128 random bits, written as 32 hex characters. */
export function newPlayerKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
