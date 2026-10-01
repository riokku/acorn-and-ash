import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLOSE_PLAYING_ELSEWHERE } from '@acorn/shared';

import {
  WorldConnection,
  playerKey,
  worldSocketUrl,
  type ConnectionState,
} from '../src/net/connection';
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
    const url = worldSocketUrl(
      'home-clearing',
      'abcdefgh1234',
      undefined,
      'http://localhost:5173/',
    );
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

/** A WebSocket that only does what the test tells it to. */
class FakeSocket extends EventTarget {
  static readonly OPEN = 1;
  static made: FakeSocket[] = [];
  readyState = 0;
  binaryType = 'blob';

  constructor(readonly url: string) {
    super();
    FakeSocket.made.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  hangUp(code: number): void {
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event('close'), { code }));
  }

  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
}

describe('staying connected to the world', () => {
  let states: ConnectionState[];
  let connection: WorldConnection;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.made = [];
    states = [];
    connection = new WorldConnection('wss://acorn.example/ws', {
      onMessage: () => {},
      onStateChange: (state) => states.push(state),
    });
    connection.connect();
    FakeSocket.made[0]?.open();
  });

  afterEach(() => {
    connection.close();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('tries again by itself after the connection drops', () => {
    FakeSocket.made[0]?.hangUp(1006);
    expect(states.at(-1)).toBe('offline');
    vi.advanceTimersByTime(2500);
    expect(FakeSocket.made).toHaveLength(2);
  });

  it('stays put once the player is playing in another tab, until asked to play here', () => {
    FakeSocket.made[0]?.hangUp(CLOSE_PLAYING_ELSEWHERE);
    expect(states.at(-1)).toBe('elsewhere');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.made).toHaveLength(1);

    connection.playHere();
    expect(FakeSocket.made).toHaveLength(2);
    expect(states.at(-1)).toBe('connecting');
  });

  it('does not open a second connection when asked to play here mid-reconnect', () => {
    FakeSocket.made[0]?.hangUp(1006);
    connection.playHere();
    vi.advanceTimersByTime(2500);
    expect(FakeSocket.made).toHaveLength(2);
  });

  it('pays no attention to a connection it has already given up on', () => {
    const first = FakeSocket.made[0];
    first?.fail();
    vi.advanceTimersByTime(2500);
    expect(FakeSocket.made).toHaveLength(2);
    FakeSocket.made[1]?.open();

    // The old one finally reporting itself closed must not tear down the new one.
    first?.hangUp(1006);
    vi.advanceTimersByTime(10_000);
    expect(FakeSocket.made).toHaveLength(2);
    expect(states.at(-1)).toBe('connected');
  });
});
