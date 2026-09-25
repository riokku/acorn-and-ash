/**
 * Rules for a player's chosen name.
 *
 * The Home screen enforces this so the button lights up before anyone hits
 * play; the server runs the very same check on arrival, because what a
 * client says it sent is never enough on its own (see architecture rule 1:
 * the server decides).
 */

export const MIN_PLAYER_NAME_LENGTH = 2;
export const MAX_PLAYER_NAME_LENGTH = 20;

/** Trims the edges and drops control characters. Never throws. */
export function sanitizePlayerName(raw: string): string {
  return raw
    .split('')
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function isValidPlayerName(name: string): boolean {
  return name.length >= MIN_PLAYER_NAME_LENGTH && name.length <= MAX_PLAYER_NAME_LENGTH;
}
