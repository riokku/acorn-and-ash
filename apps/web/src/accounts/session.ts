import type { WebEnv } from '../env';
import { AccountsNotConfiguredError, createAuth, type Auth } from './auth';
import { isPlayerKey } from './player-key';

/** Who is playing, as far as the rest of the Worker needs to know. */
export interface Account {
  readonly kind: 'guest' | 'member';
  /** What the worlds know this player by. Never sent to the browser. */
  readonly playerKey: string;
}

function authFor(env: WebEnv, request: Request): Auth {
  return createAuth(env, new URL(request.url).origin);
}

/**
 * The account behind this request's session cookie, if there is one, and any
 * cookies to hand back so the year it lasts is pushed back by this visit.
 */
export async function resumeSession(
  request: Request,
  env: WebEnv,
): Promise<{ account: Account | null; cookies: string[] }> {
  const { headers, response } = await authFor(env, request).api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const cookies = headers.getSetCookie();
  const user = response?.user;
  if (!user || !isPlayerKey(user.playerKey)) return { account: null, cookies };

  return {
    account: { kind: user.isAnonymous ? 'guest' : 'member', playerKey: user.playerKey },
    cookies,
  };
}

/** The account behind this request's session cookie, or null if there isn't one. */
export async function signedInAccount(request: Request, env: WebEnv): Promise<Account | null> {
  return (await resumeSession(request, env)).account;
}

/**
 * Give a browser that has no account yet one of its own, as a guest.
 *
 * `earlierKey` is the key a browser used before accounts existed. Handing it
 * over lets that browser's old character carry on under its new account
 * instead of starting again. Only a brand-new guest can take one, and only if
 * no other account already has it, so this can't be used to pick up a key that
 * belongs to somebody else's account.
 */
export async function startGuest(
  request: Request,
  env: WebEnv,
  earlierKey: unknown,
): Promise<Response> {
  const { headers, response } = await authFor(env, request).api.signInAnonymous({
    headers: request.headers,
    returnHeaders: true,
  });

  if (isPlayerKey(earlierKey) && response?.user.id) {
    await adoptEarlierKey(env.DB, response.user.id, earlierKey);
  }

  const reply = Response.json({ kind: 'guest', created: true }, { status: 201 });
  for (const cookie of headers.getSetCookie()) reply.headers.append('set-cookie', cookie);
  return reply;
}

/** Whether the guest took the key. Taken keys, and a lost race for one, return false. */
export async function adoptEarlierKey(
  database: D1Database,
  userId: string,
  key: string,
): Promise<boolean> {
  try {
    const result = await database
      .prepare(
        `UPDATE user SET player_key = ?1
         WHERE id = ?2 AND is_anonymous = 1
           AND NOT EXISTS (SELECT 1 FROM user WHERE player_key = ?1)`,
      )
      .bind(key, userId)
      .run();
    return result.meta.changes === 1;
  } catch {
    // The unique index on player_key: somebody took it between the check and
    // the write. The guest simply keeps the fresh key it was given.
    return false;
  }
}

export { AccountsNotConfiguredError };
