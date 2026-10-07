import { describe, expect, it, vi } from 'vitest';

import {
  SignInError,
  deleteCharacter,
  earlierPlayerKey,
  fetchSavedCharacter,
  fetchSessionStatus,
  loginPath,
  resumeAccount,
  signInAsTestPlayer,
  signOut,
} from '../src/net/account';

function fakeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

const answer = (status: number, body: unknown = {}): typeof fetch =>
  vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

describe('the key a browser used before accounts', () => {
  it('is found when there is one', () => {
    const storage = fakeStorage({ 'acorn.playerKey': '0123456789abcdef01234567' });
    expect(earlierPlayerKey(storage)).toBe('0123456789abcdef01234567');
  });

  it('is not found for a browser that never had one', () => {
    expect(earlierPlayerKey(fakeStorage())).toBeNull();
  });

  it('is ignored when it is not shaped like a key', () => {
    expect(earlierPlayerKey(fakeStorage({ 'acorn.playerKey': 'nope!' }))).toBeNull();
  });

  it('is not an error when the browser will not let us look', () => {
    const locked = {
      getItem: () => {
        throw new Error('storage is switched off');
      },
    } as unknown as Storage;
    expect(earlierPlayerKey(locked)).toBeNull();
  });

  it('is never created by looking: a new browser makes no key of its own', () => {
    const storage = fakeStorage();
    earlierPlayerKey(storage);
    expect(storage.length).toBe(0);
  });
});

describe('finding out who is signed in', () => {
  it('reads what the site says', async () => {
    const status = await fetchSessionStatus(
      answer(200, {
        signedIn: true,
        name: 'Ada',
        providers: ['google', 'discord'],
        testSignIn: null,
      }),
    );
    expect(status).toEqual({
      signedIn: true,
      name: 'Ada',
      providers: ['google', 'discord'],
      testSignIn: null,
    });
  });

  it('asks with the cookie, and only that', async () => {
    const send = answer(200, { signedIn: false });
    await fetchSessionStatus(send);
    expect(send).toHaveBeenCalledWith('/api/session', { credentials: 'same-origin' });
  });

  it('ignores anything it does not recognise', async () => {
    const status = await fetchSessionStatus(
      answer(200, { signedIn: 'yes', providers: ['google', 'myspace', 7], testSignIn: 'always' }),
    );
    expect(status).toEqual({
      signedIn: false,
      name: null,
      providers: ['google'],
      testSignIn: null,
    });
  });

  it('says so when the site will not answer', async () => {
    await expect(fetchSessionStatus(answer(503))).rejects.toThrow('Could not sign in (503)');
  });
});

describe('going to a login service', () => {
  it('is a plain link to the site, which does the rest', () => {
    expect(loginPath('google')).toBe('/api/login/google');
    expect(loginPath('discord')).toBe('/api/login/discord');
  });
});

describe('saying "I\'m here" once signed in', () => {
  it('asks the site, passing along the key from before accounts', async () => {
    const send = answer(200, { signedIn: true });
    await resumeAccount(fakeStorage({ 'acorn.playerKey': '0123456789abcdef01234567' }), send);

    expect(send).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ earlierKey: '0123456789abcdef01234567' }),
      }),
    );
  });

  it('passes nothing along for a browser with no history', async () => {
    const send = answer(200, { signedIn: true });
    await resumeAccount(fakeStorage(), send);

    expect(send).toHaveBeenCalledWith('/api/session', expect.objectContaining({ body: '{}' }));
  });

  it('finds out the session has ended', async () => {
    const failure = resumeAccount(fakeStorage(), answer(401));
    await expect(failure).rejects.toBeInstanceOf(SignInError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
  });

  it('gives the status for any other failure', async () => {
    await expect(resumeAccount(fakeStorage(), answer(503))).rejects.toThrow(
      'Could not sign in (503)',
    );
  });
});

describe('test players and signing out', () => {
  it('signs in a test player with a POST', async () => {
    const send = answer(201);
    await signInAsTestPlayer(send);
    expect(send).toHaveBeenCalledWith(
      '/api/test-sign-in',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
  });

  it('says to try again soon when there have been too many sign-ins', async () => {
    const failure = signInAsTestPlayer(answer(429));
    await expect(failure).rejects.toThrow('Try again in a minute');
  });

  it('signs out with a POST', async () => {
    const send = answer(200);
    await signOut(send);
    expect(send).toHaveBeenCalledWith('/api/sign-out', expect.objectContaining({ method: 'POST' }));
  });

  it('says so when the site would not sign the player out', async () => {
    await expect(signOut(answer(500))).rejects.toThrow('Signing out failed');
  });
});

describe('deleting the character', () => {
  it('asks the site to delete it with a DELETE, for the world it was given', async () => {
    const send = answer(200);
    await deleteCharacter('home clearing', send);
    expect(send).toHaveBeenCalledWith('/api/worlds/home%20clearing/character', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  });

  it('says so when the site would not delete it, so nothing is forgotten here', async () => {
    await expect(deleteCharacter('home-clearing', answer(500))).rejects.toThrow(
      'Deleting the character failed',
    );
  });

  it('says the player is not signed in when the session has ended', async () => {
    await expect(deleteCharacter('home-clearing', answer(401))).rejects.toBeInstanceOf(SignInError);
  });
});

describe('the character already made in a world', () => {
  const made = { made: true, name: 'Acorn', character: 'knight', color: 'moss' };

  it('is the one the server describes', async () => {
    expect(await fetchSavedCharacter('home-clearing', answer(200, made))).toEqual({
      name: 'Acorn',
      character: 'knight',
      color: 'moss',
    });
  });

  it('asks about the world it was given, as the signed-in player', async () => {
    const send = answer(200, { made: false });
    await fetchSavedCharacter('home clearing', send);
    expect(send).toHaveBeenCalledWith('/api/worlds/home%20clearing/character', {
      credentials: 'same-origin',
    });
  });

  it('is nothing when none has been made', async () => {
    expect(await fetchSavedCharacter('home-clearing', answer(200, { made: false }))).toBeNull();
  });

  it('is nothing when the server says something that is not a character', async () => {
    for (const body of [
      { made: true, name: 'A', character: 'knight', color: 'moss' },
      { made: true, name: 'Acorn', character: 'dragon', color: 'moss' },
      { made: true, name: 'Acorn', character: 'knight', color: 'ultraviolet' },
      { made: true, character: 'knight', color: 'moss' },
      null,
    ]) {
      expect(await fetchSavedCharacter('home-clearing', answer(200, body))).toBeNull();
    }
  });

  it('finds out the session has ended', async () => {
    await expect(fetchSavedCharacter('home-clearing', answer(401))).rejects.toMatchObject({
      status: 401,
    });
  });
});
