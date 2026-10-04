import type { WebEnv } from '../env';
import { AccountsNotConfiguredError, createAuth, type Auth } from './auth';
import type { Provider } from './options';
import { isPlayerKey } from './player-key';

/** Who is playing, as far as the rest of the Worker needs to know. */
export interface Account {
  /** `test` is a test player (decision 0086); everybody real is a `member`. */
  readonly kind: 'test' | 'member';
  readonly id: string;
  /** What the account is called at the login service. Only ever shown back to them. */
  readonly name: string;
  /** What the worlds know this player by. Never sent to the browser. */
  readonly playerKey: string;
  /** Whether this account has ever joined a world. */
  readonly entered: boolean;
}

function authFor(env: WebEnv, request: Request): Auth {
  return createAuth(env, new URL(request.url).origin);
}

/** A reply that also hands over the cookies Better Auth just set or cleared. */
function replyWith(cookies: string[], body: unknown, init: ResponseInit = {}): Response {
  const reply = Response.json(body, init);
  for (const cookie of cookies) reply.headers.append('set-cookie', cookie);
  return reply;
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
    account: {
      kind: user.isAnonymous ? 'test' : 'member',
      id: user.id,
      name: user.name,
      playerKey: user.playerKey,
      entered: user.enteredAt != null,
    },
    cookies,
  };
}

/** The account behind this request's session cookie, or null if there isn't one. */
export async function signedInAccount(request: Request, env: WebEnv): Promise<Account | null> {
  return (await resumeSession(request, env)).account;
}

/**
 * Send a browser off to Google or Discord to sign in.
 *
 * Better Auth makes the address to send them to, and a cookie that lets it
 * recognise them when they come back; both are handed on. Where they land
 * afterwards is the game itself, whether it went well or not.
 */
export async function beginSignIn(
  request: Request,
  env: WebEnv,
  provider: Provider,
): Promise<Response> {
  const { headers, response } = await authFor(env, request).api.signInSocial({
    body: {
      provider,
      callbackURL: '/',
      newUserCallbackURL: '/',
      errorCallbackURL: '/?signin=failed',
    },
    headers: request.headers,
    returnHeaders: true,
  });
  if (!response.url) return Response.json({ error: 'Could not start signing in' }, { status: 502 });

  const reply = new Response(null, { status: 302, headers: { location: response.url } });
  for (const cookie of headers.getSetCookie()) reply.headers.append('set-cookie', cookie);
  return reply;
}

/** Let the player go: ends this session and clears its cookie. */
export async function endSession(request: Request, env: WebEnv): Promise<Response> {
  const { headers } = await authFor(env, request).api.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  return replyWith(headers.getSetCookie(), { signedIn: false });
}

/**
 * Give a browser a test player of its own, with no Google or Discord account.
 * Only for the places `testSignInMode` allows; the route checks that first.
 */
export async function startTestPlayer(request: Request, env: WebEnv): Promise<Response> {
  const { headers } = await authFor(env, request).api.signInAnonymous({
    headers: request.headers,
    returnHeaders: true,
  });
  return replyWith(headers.getSetCookie(), { created: true }, { status: 201 });
}

/**
 * Let a signed-in account take over the key a browser played under before
 * accounts existed, so a character made then carries on instead of starting
 * again.
 *
 * Only an account that has never joined a world can do it, and only if no other
 * account has that key, so it can't be used to pick up somebody else's, or to
 * swap away a character already made. A lost race for a key returns false too.
 */
export async function adoptEarlierKey(
  database: D1Database,
  userId: string,
  key: string,
): Promise<boolean> {
  try {
    const result = await database
      .prepare(
        `UPDATE user SET player_key = ?1
         WHERE id = ?2 AND entered_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM user WHERE player_key = ?1)`,
      )
      .bind(key, userId)
      .run();
    return result.meta.changes === 1;
  } catch {
    // The unique index on player_key: somebody took it between the check and
    // the write. The account simply keeps the fresh key it was given.
    return false;
  }
}

/** Note that this account has joined a world, so its key can no longer be swapped. */
export async function markEntered(database: D1Database, userId: string): Promise<void> {
  await database
    .prepare('UPDATE user SET entered_at = ?1 WHERE id = ?2 AND entered_at IS NULL')
    .bind(Date.now(), userId)
    .run();
}

export { AccountsNotConfiguredError };
