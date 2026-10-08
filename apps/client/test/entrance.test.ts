import { describe, expect, it } from 'vitest';

import { findEntrance } from '../src/home/entrance';

function fakeStorage(): Storage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

/** A site that answers each request from a table, and remembers what it was asked. */
function fakeSite(answers: Record<string, () => Response>): {
  send: typeof fetch;
  asked: string[];
} {
  const asked: string[] = [];
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    asked.push(key);
    const answer = answers[key];
    if (!answer) throw new Error(`Nothing is expected to ask for ${key}`);
    return answer();
  }) as typeof fetch;
  return { send, asked };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    Response.json(body, { status });

const SIGNED_OUT = { signedIn: false, providers: ['google', 'discord'], testSignIn: null };
const SIGNED_IN = { signedIn: true, name: 'Ada', providers: [], testSignIn: null };

describe('the first screen', () => {
  it('is the sign-in screen for somebody who is not signed in', async () => {
    const { send, asked } = fakeSite({ 'GET /api/session': json(SIGNED_OUT) });

    const entrance = await findEntrance(fakeStorage(), 'home-clearing', send);

    expect(entrance).toEqual({
      kind: 'sign-in',
      status: { signedIn: false, name: null, providers: ['google', 'discord'], testSignIn: null },
      frontPage: true,
    });
    // Nothing about a world is asked until somebody is signed in.
    expect(asked).toEqual(['GET /api/session']);
  });

  it('is the character creator for somebody who is signed in and has no character yet', async () => {
    const { send } = fakeSite({
      'GET /api/session': json(SIGNED_IN),
      'POST /api/session': json(SIGNED_IN),
      'GET /api/worlds/home-clearing/character': json({ made: false }),
    });

    expect(await findEntrance(fakeStorage(), 'home-clearing', send)).toEqual({
      kind: 'home',
      accountName: 'Ada',
      saved: null,
      frontPage: true,
    });
  });

  it('is a welcome back, to their own character, for somebody who has one', async () => {
    const { send } = fakeSite({
      'GET /api/session': json(SIGNED_IN),
      'POST /api/session': json(SIGNED_IN),
      'GET /api/worlds/home-clearing/character': json({
        made: true,
        name: 'Acorn',
        character: 'knight',
        color: 'moss',
      }),
    });

    expect(await findEntrance(fakeStorage(), 'home-clearing', send)).toEqual({
      kind: 'home',
      accountName: 'Ada',
      saved: { name: 'Acorn', character: 'knight', color: 'moss', skin: 'natural' },
      frontPage: true,
    });
  });

  it('asks about the world the address named', async () => {
    const { send, asked } = fakeSite({
      'GET /api/session': json(SIGNED_IN),
      'POST /api/session': json(SIGNED_IN),
      'GET /api/worlds/test-world/character': json({ made: false }),
    });

    await findEntrance(fakeStorage(), 'test-world', send);
    expect(asked).toContain('GET /api/worlds/test-world/character');
  });
});

describe('where test sign-in is automatic', () => {
  it('makes a test player on the spot, with no sign-in screen to get past', async () => {
    let signedIn = false;
    const { send } = fakeSite({
      'GET /api/session': () =>
        Response.json(
          signedIn
            ? { ...SIGNED_IN, testSignIn: 'automatic' }
            : { ...SIGNED_OUT, testSignIn: 'automatic' },
        ),
      'POST /api/test-sign-in': () => {
        signedIn = true;
        return Response.json({ created: true }, { status: 201 });
      },
      'POST /api/session': json(SIGNED_IN),
      'GET /api/worlds/home-clearing/character': json({ made: false }),
    });

    const entrance = await findEntrance(fakeStorage(), 'home-clearing', send);
    expect(entrance.kind).toBe('home');
    // Every browser test starts at the Home screen, not at a Play button.
    expect(entrance.frontPage).toBe(false);
  });

  it('still shows the sign-in screen where the test sign-in is a button', async () => {
    const { send } = fakeSite({
      'GET /api/session': json({ ...SIGNED_OUT, providers: [], testSignIn: 'button' }),
    });

    const entrance = await findEntrance(fakeStorage(), 'home-clearing', send);
    expect(entrance.kind).toBe('sign-in');
    // A preview is where somebody sees the real front page.
    expect(entrance.frontPage).toBe(true);
  });
});

describe('when things go wrong', () => {
  it('goes back to sign-in if the session ends between two questions', async () => {
    const { send } = fakeSite({
      'GET /api/session': json(SIGNED_IN),
      'POST /api/session': json({ error: 'Sign in first' }, 401),
    });

    const entrance = await findEntrance(fakeStorage(), 'home-clearing', send);
    expect(entrance).toMatchObject({ kind: 'sign-in', status: { signedIn: false, name: null } });
  });

  it('says so, rather than guessing, when the site cannot be reached', async () => {
    const { send } = fakeSite({ 'GET /api/session': json({ error: 'down' }, 503) });
    await expect(findEntrance(fakeStorage(), 'home-clearing', send)).rejects.toThrow(
      'Could not sign in (503)',
    );
  });
});
