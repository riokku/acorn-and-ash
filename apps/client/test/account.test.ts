import { describe, expect, it, vi } from 'vitest';

import { SignInError, earlierPlayerKey, ensureAccount } from '../src/net/account';

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

const answer = (status: number): typeof fetch =>
  vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch;

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

describe('making sure the browser has an account', () => {
  it('asks the site, passing along the key from before accounts', async () => {
    const send = answer(201);
    await ensureAccount(fakeStorage({ 'acorn.playerKey': '0123456789abcdef01234567' }), send);

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
    const send = answer(201);
    await ensureAccount(fakeStorage(), send);

    expect(send).toHaveBeenCalledWith('/api/session', expect.objectContaining({ body: '{}' }));
  });

  it('is happy with a browser that already had an account', async () => {
    await expect(ensureAccount(fakeStorage(), answer(200))).resolves.toBeUndefined();
  });

  it('says to try again soon when there have been too many new players', async () => {
    const failure = ensureAccount(fakeStorage(), answer(429));
    await expect(failure).rejects.toBeInstanceOf(SignInError);
    await expect(failure).rejects.toThrow('Try again in a minute');
  });

  it('gives the status for any other failure', async () => {
    await expect(ensureAccount(fakeStorage(), answer(503))).rejects.toThrow(
      'Could not sign in (503)',
    );
  });
});
