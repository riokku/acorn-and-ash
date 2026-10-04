import { SELF } from 'cloudflare:test';

/**
 * An address the Worker treats as your own machine, where test players may
 * sign in. The tests that need a deployed address use `LIVE_SITE`.
 */
export const SITE = 'https://localhost';

/** What a deployed staging address looks like: the bare Worker name, no alias. */
export const LIVE_SITE = 'https://acorn-ash-web-staging.example.workers.dev';

/** What a browser would send back for the cookies a response just set. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/** A new browser's first visit on your own machine: a test player and its cookie. */
export async function startAsTestPlayer(): Promise<{ cookie: string }> {
  const response = await SELF.fetch(`${SITE}/api/test-sign-in`, { method: 'POST' });
  if (response.status !== 201) throw new Error(`Could not start a test player: ${response.status}`);
  return { cookie: cookieHeader(response) };
}

/** Tell the Worker who is here, handing over the key an earlier browser played under. */
export function sayHere(cookie: string, earlierKey?: string): Promise<Response> {
  return SELF.fetch(`${SITE}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(earlierKey === undefined ? {} : { earlierKey }),
  });
}

/** What the world was told about this browser, via the stub game server. */
export async function playerSeenByWorld(
  cookie: string,
  extraQuery = '',
): Promise<{ status: number; player: string | null }> {
  const response = await SELF.fetch(`${SITE}/api/worlds/home-clearing/ws${extraQuery}`, {
    headers: { Upgrade: 'websocket', cookie },
  });
  if (response.status !== 200) return { status: response.status, player: null };
  const body = (await response.json()) as { player: string | null };
  return { status: 200, player: body.player };
}
