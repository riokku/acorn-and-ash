/**
 * Small memory for the front page (decision 0103): has this browser tab already
 * pressed Play, and which of "Create account" and "Log in" should come first.
 */

/** The two ways in on the front page. Both end at the same Google and Discord buttons. */
export type AccountTab = 'create' | 'login';

const PASSED_KEY = 'acorn.front-door';

/**
 * Whether Play has been pressed in this tab. It is kept per tab, not per
 * browser: coming back from Google or Discord lands in the same tab, so a
 * player is not asked to press Play twice, while a fresh visit sees the front
 * page again.
 */
export function hasPassedFrontDoor(storage: Storage): boolean {
  try {
    return storage.getItem(PASSED_KEY) === '1';
  } catch {
    // Storage can be switched off; then the front page just shows again.
    return false;
  }
}

export function markFrontDoorPassed(storage: Storage): void {
  try {
    storage.setItem(PASSED_KEY, '1');
  } catch {
    // Nothing to remember it with, which only means one extra Play press.
  }
}

/** Signing out starts over from the front page. */
export function resetFrontDoor(storage: Storage): void {
  try {
    storage.removeItem(PASSED_KEY);
  } catch {
    // Nothing was remembered, so there is nothing to forget.
  }
}

/**
 * Somebody who has played here before most likely wants "Log in"; a stranger
 * most likely wants "Create account". Either is one click away.
 */
export function firstTab(nameLastPlayedAs: string): AccountTab {
  return nameLastPlayedAs === '' ? 'create' : 'login';
}
