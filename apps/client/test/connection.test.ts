import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLOSE_CHARACTER_DELETED, CLOSE_PLAYING_ELSEWHERE } from '@acorn/shared';

import { WorldConnection, worldSocketUrl, type ConnectionState } from '../src/net/connection';
import { readSettings } from '../src/settings';

describe('finding the world server', () => {
  it('uses the origin the page came from', () => {
    const url = worldSocketUrl('home-clearing', 'https://acorn.example/play?x=1');
    expect(url).toBe('wss://acorn.example/api/worlds/home-clearing/ws');
  });

  it('uses ws, not wss, when the page is not secure', () => {
    const url = worldSocketUrl('home-clearing', 'http://localhost:5173/');
    expect(url).toBe('ws://localhost:5173/api/worlds/home-clearing/ws');
  });

  it('does not say who is connecting: the session cookie does', () => {
    const url = worldSocketUrl('home-clearing', 'https://acorn.example/');
    expect(new URL(url).searchParams.has('player')).toBe(false);
  });

  it('carries a season asked for while testing, and nothing else of the address', () => {
    const url = worldSocketUrl(
      'home-clearing',
      'https://acorn.example/?x=1&season=autumn',
      'winter',
    );
    expect(url).toBe('wss://acorn.example/api/worlds/home-clearing/ws?season=winter');
  });

  it('asks for no season when the address did not', () => {
    const url = worldSocketUrl('home-clearing', 'https://acorn.example/?season=winter');
    expect(new URL(url).searchParams.has('season')).toBe(false);
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

  it('stays shut for good once the character was deleted, and says so', () => {
    FakeSocket.made[0]?.hangUp(CLOSE_CHARACTER_DELETED);
    expect(states.at(-1)).toBe('deleted');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.made).toHaveLength(1);

    // Unlike playing elsewhere, there is nothing to ask to play here again as.
    connection.playHere();
    expect(FakeSocket.made).toHaveLength(1);
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

describe('signing in before connecting', () => {
  let states: ConnectionState[];
  let details: (string | undefined)[];
  let signIn: ReturnType<typeof vi.fn<() => Promise<void>>>;

  const connectWith = (handler: () => Promise<void>): WorldConnection => {
    signIn = vi.fn(handler);
    const connection = new WorldConnection(
      'wss://acorn.example/ws',
      {
        onMessage: () => {},
        onStateChange: (state, detail) => {
          states.push(state);
          details.push(detail);
        },
      },
      { signIn },
    );
    connection.connect();
    return connection;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.made = [];
    states = [];
    details = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens the connection only once the browser has an account', async () => {
    let finish: () => void = () => {};
    const connection = connectWith(() => new Promise<void>((resolve) => (finish = resolve)));

    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.made).toHaveLength(0);
    expect(states.at(-1)).toBe('connecting');

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.made).toHaveLength(1);
    connection.close();
  });

  it('says why, waits, and signs in again when it could not', async () => {
    let attempts = 0;
    const connection = connectWith(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Could not sign in (503)');
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toBe('offline');
    expect(details.at(-1)).toBe('Could not sign in (503)');
    expect(FakeSocket.made).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2500);
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(FakeSocket.made).toHaveLength(1);
    connection.close();
  });

  it('signs in again for each reconnect, so a lost cookie is replaced', async () => {
    const connection = connectWith(async () => {});
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.made[0]?.open();

    FakeSocket.made[0]?.hangUp(1006);
    await vi.advanceTimersByTimeAsync(2500);

    expect(signIn).toHaveBeenCalledTimes(2);
    expect(FakeSocket.made).toHaveLength(2);
    connection.close();
  });

  it('opens nothing if the player left while it was signing in', async () => {
    let finish: () => void = () => {};
    const connection = connectWith(() => new Promise<void>((resolve) => (finish = resolve)));

    connection.close();
    finish();
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeSocket.made).toHaveLength(0);
  });
});
