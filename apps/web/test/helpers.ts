import { SELF } from 'cloudflare:test';

export const SITE = 'https://acorn.test';

/** What a browser would send back for the cookies a response just set. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/** A new browser's first visit: it gets a guest account and its cookie. */
export async function startAsGuest(earlierKey?: string): Promise<{ cookie: string }> {
  const response = await SELF.fetch(`${SITE}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(earlierKey === undefined ? {} : { earlierKey }),
  });
  if (response.status !== 201) throw new Error(`Could not start a guest: ${response.status}`);
  return { cookie: cookieHeader(response) };
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
