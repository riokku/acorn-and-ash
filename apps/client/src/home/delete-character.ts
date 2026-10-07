/**
 * Deleting a character (decision 0108).
 *
 * The one thing here that is a rule rather than a screen: when the name the
 * player typed counts as "yes, this one". Case and stray spaces don't matter,
 * so a typo in capitals can't leave them stuck, but they do have to type it.
 */

import { ABANDONED_BUILD_SECONDS, sanitizePlayerName } from '@acorn/shared';

/** Where the "your character was deleted" note waits across the page reload. */
const NOTICE_KEY = 'acorn.characterDeletedNotice';

/** What the character screen says, once, to somebody who has just deleted their character. */
export const CHARACTER_DELETED_NOTICE = `Your character is gone. Their cabin and everything else they made stay locked and fade away in ${ABANDONED_BUILD_SECONDS / 60} minutes.`;

/** True when `typed` is the character's name, ignoring capitals and spaces at the edges. */
export function matchesCharacterName(typed: string, characterName: string): boolean {
  const wanted = sanitizePlayerName(characterName).toLowerCase();
  return wanted !== '' && sanitizePlayerName(typed).toLowerCase() === wanted;
}

/** Leave the note for the next page load. Storage being off just means no note. */
export function rememberCharacterDeleted(storage: Storage): void {
  try {
    storage.setItem(NOTICE_KEY, '1');
  } catch {
    // No note is better than a failed restart.
  }
}

/** The note for this page load, if a character was just deleted. Shown once. */
export function takeCharacterDeletedNotice(storage: Storage): string | null {
  try {
    if (storage.getItem(NOTICE_KEY) === null) return null;
    storage.removeItem(NOTICE_KEY);
    return CHARACTER_DELETED_NOTICE;
  } catch {
    return null;
  }
}
