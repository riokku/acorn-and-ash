/**
 * Being somebody the world remembers.
 *
 * Every browser gets an account the first time it plays, as a guest, and from
 * then on a cookie says which one. There is nothing to type and nothing to
 * keep: the world server looks the player up from the cookie, and the browser
 * never holds the key a world saves its characters under.
 */

/**
 * Where browsers kept their key before accounts existed. It is still read once,
 * so a character made then carries on under the account that replaces it
 * instead of starting again. Nothing writes it any more.
 */
const EARLIER_KEY_STORAGE = 'acorn.playerKey';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** The key this browser played under before accounts, if it ever did. */
export function earlierPlayerKey(storage: Storage): string | null {
  try {
    const key = storage.getItem(EARLIER_KEY_STORAGE);
    return key !== null && KEY_PATTERN.test(key) ? key : null;
  } catch {
    // Storage can be switched off entirely; that is a browser with no history.
    return null;
  }
}

/** Raised when the world server would not sign this browser in. */
export class SignInError extends Error {
  constructor(readonly status: number) {
    super(
      status === 429
        ? 'Too many new players from this connection. Try again in a minute'
        : `Could not sign in (${status})`,
    );
  }
}

/**
 * Make sure this browser has an account. Safe to repeat: one that already has
 * one is simply told so. Done before every connection, so a cookie that has
 * gone missing is replaced instead of leaving the player stuck offline.
 */
export async function ensureAccount(
  storage: Storage,
  send: typeof fetch = (input, init) => fetch(input, init),
): Promise<void> {
  const earlierKey = earlierPlayerKey(storage);
  const response = await send('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(earlierKey === null ? {} : { earlierKey }),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new SignInError(response.status);
}
