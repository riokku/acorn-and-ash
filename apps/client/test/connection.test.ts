import { describe, expect, it } from 'vitest';

import { playerKey, worldSocketUrl } from '../src/net/connection';
import { readSettings } from '../src/settings';

describe('finding the world server', () => {
  it('uses the origin the page came from', () => {
    const url = worldSocketUrl(
      'home-clearing',
      'abcdefgh1234',
      undefined,
      'https://acorn.example/play?x=1',
    );
    expect(url).toBe('wss://acorn.example/api/worlds/home-clearing/ws?player=abcdefgh1234');
  });

  it('uses ws, not wss, when the page is not secure', () => {
    const url = worldSocketUrl('home-clearing', 'abcdefgh1234', undefined, 'http://localhost:5173/');
    expect(url.startsWith('ws://localhost:5173/')).toBe(true);
  });

  it('can be pointed at another server entirely', () => {
    const url = worldSocketUrl(
      'home-clearing',
      'abcdefgh1234',
      'https://acorn-ash-web-staging.workers.dev',
      'http://localhost:5173/',
    );
    expect(url.startsWith('wss://acorn-ash-web-staging.workers.dev/')).toBe(true);
  });
});

describe('remembering who you are', () => {
  const fakeStorage = (): Storage => {
    const map = new Map<string, string>();
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
  };

  it('makes a key once and keeps it', () => {
    const storage = fakeStorage();
    const first = playerKey(storage);
    expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(playerKey(storage)).toBe(first);
  });

  it('replaces a key that has been tampered with', () => {
    const storage = fakeStorage();
    storage.setItem('acorn.playerKey', 'nope!');
    expect(playerKey(storage)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe('settings', () => {
  it('lets the renderer be forced to the WebGL 2 fallback', () => {
    expect(readSettings('?renderer=webgl2').forceWebGL).toBe(true);
    expect(readSettings('').forceWebGL).toBe(false);
  });

  it('lets a world be chosen from the address bar', () => {
    expect(readSettings('?world=test-world').worldId).toBe('test-world');
  });
});
